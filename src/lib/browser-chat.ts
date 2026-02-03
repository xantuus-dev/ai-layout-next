/**
 * Browser Chat Service
 *
 * Provides AI chat functionality for webpages:
 * - Content extraction using Readability.js
 * - Context caching in database
 * - AI-powered chat with webpage understanding
 */

import { prisma } from './prisma';
import { aiRouter } from './ai-providers';
import { calculateChatCredits } from './credits';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export interface PageContent {
  url: string;
  title: string;
  mainContent: string; // Markdown format
  structuredData: {
    headings: Array<{ level: number; text: string }>;
    links: Array<{ text: string; href: string }>;
    images: Array<{ alt: string; src: string }>;
  };
  metadata: {
    description?: string;
    author?: string;
    siteName?: string;
    published?: string;
  };
  wordCount: number;
}

export interface ChatContext {
  sessionId: string;
  url: string;
  title: string;
  content: string;
  summary?: string;
  wordCount: number;
}

/**
 * Extract main content from HTML using Readability.js
 */
export async function extractPageContent(html: string, url: string): Promise<PageContent> {
  try {
    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Extract main content using Readability
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to extract readable content from page');
    }

    // Convert HTML to Markdown for better AI processing
    const mainContent = turndownService.turndown(article.content || '');

    // Extract structured data
    const headings: Array<{ level: number; text: string }> = [];
    const links: Array<{ text: string; href: string }> = [];
    const images: Array<{ alt: string; src: string }> = [];

    // Extract headings
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent?.trim() || '';
      if (text) {
        headings.push({ level, text });
      }
    });

    // Extract links
    document.querySelectorAll('a[href]').forEach((link) => {
      const text = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      if (text && href && !href.startsWith('#')) {
        links.push({ text, href });
      }
    });

    // Extract images
    document.querySelectorAll('img[src]').forEach((img) => {
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || '';
      if (src) {
        images.push({ alt, src });
      }
    });

    // Extract metadata
    const metadata: PageContent['metadata'] = {};

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metadata.description = metaDescription.getAttribute('content') || undefined;
    }

    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) {
      metadata.author = metaAuthor.getAttribute('content') || undefined;
    }

    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      metadata.siteName = ogSiteName.getAttribute('content') || undefined;
    }

    const published = document.querySelector('meta[property="article:published_time"]');
    if (published) {
      metadata.published = published.getAttribute('content') || undefined;
    }

    // Calculate word count
    const wordCount = mainContent.split(/\s+/).length;

    return {
      url,
      title: article.title || 'Untitled',
      mainContent,
      structuredData: {
        headings: headings.slice(0, 50), // Limit to 50 headings
        links: links.slice(0, 100), // Limit to 100 links
        images: images.slice(0, 50), // Limit to 50 images
      },
      metadata,
      wordCount,
    };
  } catch (error) {
    console.error('Content extraction error:', error);
    throw new Error('Failed to extract page content');
  }
}

/**
 * Get or create webpage context (with caching)
 */
export async function getOrCreateContext(
  sessionId: string,
  html: string,
  url: string
): Promise<ChatContext> {
  // Check if we have a recent context for this URL in this session
  const existingContext = await prisma.webpageContext.findFirst({
    where: {
      browserSessionId: sessionId,
      url,
      isStale: false,
    },
    orderBy: { extractedAt: 'desc' },
  });

  // Return cached context if it's less than 1 hour old
  if (existingContext && existingContext.expiresAt && existingContext.expiresAt > new Date()) {
    return {
      sessionId,
      url: existingContext.url,
      title: existingContext.title || 'Untitled',
      content: existingContext.mainContent || '',
      summary: existingContext.contentSummary || undefined,
      wordCount: existingContext.mainContent?.split(/\s+/).length || 0,
    };
  }

  // Extract fresh content
  const pageContent = await extractPageContent(html, url);

  // Generate AI summary if content is large (> 2000 words)
  let summary: string | undefined;
  if (pageContent.wordCount > 2000) {
    try {
      const summaryResponse = await aiRouter.chat(
        'claude-haiku-4-5-20250529', // Use fast, cheap model for summarization
        {
          messages: [
            {
              role: 'user',
              content: `Provide a concise 3-4 sentence summary of this webpage:\n\n${pageContent.mainContent.substring(0, 10000)}`,
            },
          ],
          maxTokens: 300,
        }
      );
      summary = summaryResponse.content;
    } catch (error) {
      console.error('Summary generation error:', error);
      // Continue without summary
    }
  }

  // Store in database with 1 hour expiration
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.webpageContext.create({
    data: {
      browserSessionId: sessionId,
      url,
      title: pageContent.title,
      mainContent: pageContent.mainContent,
      structuredData: pageContent.structuredData,
      metadata: pageContent.metadata,
      contentSummary: summary,
      expiresAt,
    },
  });

  return {
    sessionId,
    url,
    title: pageContent.title,
    content: pageContent.mainContent,
    summary,
    wordCount: pageContent.wordCount,
  };
}

/**
 * Build focused context for AI chat
 * Truncates content intelligently to fit within token limits
 */
export function buildChatContext(context: ChatContext, maxWords: number = 3000): string {
  let content = context.content;

  // If content is too long, use summary + truncated content
  if (context.wordCount > maxWords) {
    const truncated = content.split(/\s+/).slice(0, maxWords).join(' ');

    if (context.summary) {
      return `# ${context.title}

**Summary:** ${context.summary}

**Content Preview:**
${truncated}

...

(Content truncated for brevity. Ask specific questions about any section.)`;
    } else {
      return `# ${context.title}

${truncated}

...

(Content truncated. Original length: ~${context.wordCount} words)`;
    }
  }

  return `# ${context.title}

${content}`;
}

/**
 * Process chat message with AI
 */
export async function processChatMessage(
  sessionId: string,
  userMessage: string,
  context: ChatContext,
  model: string = 'claude-sonnet-4-5-20250929',
  thinkingEnabled: boolean = false
): Promise<{
  assistantMessage: string;
  tokens: number;
  credits: number;
  thinkingContent?: string;
}> {
  // Get chat history
  const chatHistory = await prisma.chatMessage.findMany({
    where: { browserSessionId: sessionId },
    orderBy: { createdAt: 'asc' },
    take: 20, // Last 20 messages for context
  });

  // Build conversation history
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  // Add system message with page context
  const contextContent = buildChatContext(context);
  messages.push({
    role: 'system',
    content: `You are an AI assistant helping the user understand and interact with a webpage. Here is the page content:

${contextContent}

Answer questions about this page, extract information, summarize sections, or help with any tasks related to the content. Be concise and accurate.`,
  });

  // Add chat history
  for (const msg of chatHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  // Call AI
  const response = await aiRouter.chat(model, {
    messages,
    maxTokens: 2000,
    thinking: thinkingEnabled ? { type: 'enabled', budget_tokens: 1000 } : undefined,
  });

  // Calculate credits
  const isFirstMessage = chatHistory.length === 0;
  const credits = calculateChatCredits(response.usage.totalTokens, isFirstMessage);

  // Save user message
  await prisma.chatMessage.create({
    data: {
      browserSessionId: sessionId,
      role: 'user',
      content: userMessage,
      contextUrl: context.url,
    },
  });

  // Save assistant message
  await prisma.chatMessage.create({
    data: {
      browserSessionId: sessionId,
      role: 'assistant',
      content: response.content,
      model,
      tokens: response.usage.totalTokens,
      credits,
      thinkingEnabled,
      contextUrl: context.url,
    },
  });

  // Update session credits
  await prisma.browserSession.update({
    where: { id: sessionId },
    data: {
      totalCreditsUsed: { increment: credits },
      totalTokensUsed: { increment: response.usage.totalTokens },
    },
  });

  return {
    assistantMessage: response.content,
    tokens: response.usage.totalTokens,
    credits,
    thinkingContent: (response as any).thinking, // Optional thinking content
  };
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(sessionId: string) {
  const messages = await prisma.chatMessage.findMany({
    where: { browserSessionId: sessionId },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    model: msg.model,
    tokens: msg.tokens,
    credits: msg.credits,
    thinkingEnabled: msg.thinkingEnabled,
    contextUrl: msg.contextUrl,
    createdAt: msg.createdAt,
  }));
}

/**
 * Clear chat history for a session
 */
export async function clearChatHistory(sessionId: string): Promise<void> {
  await prisma.chatMessage.deleteMany({
    where: { browserSessionId: sessionId },
  });
}

/**
 * Generate quick actions based on page content
 */
export function getQuickActions(context: ChatContext): Array<{ label: string; prompt: string }> {
  const actions = [
    {
      label: 'Summarize',
      prompt: 'Provide a comprehensive summary of this page in 3-4 paragraphs.',
    },
    {
      label: 'Key Points',
      prompt: 'Extract the main key points from this page as a bullet list.',
    },
  ];

  // Add context-specific actions based on content
  if (context.content.includes('```') || context.content.toLowerCase().includes('code')) {
    actions.push({
      label: 'Explain Code',
      prompt: 'Explain any code examples on this page in simple terms.',
    });
  }

  if (context.wordCount > 1000) {
    actions.push({
      label: 'TL;DR',
      prompt: 'Give me a one-paragraph TL;DR of this entire page.',
    });
  }

  actions.push({
    label: 'Ask Question',
    prompt: 'What questions can I ask about this page?',
  });

  return actions;
}
