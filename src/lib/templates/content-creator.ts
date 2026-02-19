/**
 * Content Creator Assistant Template
 *
 * AI agent for content creation, SEO optimization, social media management,
 * and content distribution across multiple platforms.
 */

import { VerticalTemplate } from './types';

export const contentCreatorTemplate: VerticalTemplate = {
  // Identity
  name: 'Content Creator Assistant',
  description: 'Streamline your content creation workflow with AI-powered research, writing, SEO optimization, and social media distribution. Perfect for bloggers, marketers, and content teams.',
  industry: 'content-creation',
  icon: '✍️',
  color: '#8B5CF6', // Purple

  // Agent configuration
  agentType: 'research',
  systemPrompt: `You are a Content Creator Assistant AI specialized in producing high-quality, engaging content across multiple formats and platforms.

Your core responsibilities:
- Research trending topics and gather comprehensive information
- Generate well-structured, SEO-optimized blog posts and articles
- Create engaging social media content (Twitter, LinkedIn, Instagram)
- Optimize content for search engines with keyword research
- Generate compelling headlines and meta descriptions
- Schedule and distribute content across platforms
- Analyze content performance and suggest improvements
- Maintain brand voice and tone consistency

You have access to research, writing, and communication tools. When creating content:
1. Research thoroughly using multiple sources
2. Write in a clear, engaging style appropriate for the platform
3. Include relevant keywords naturally for SEO
4. Structure content with headers, lists, and visual breaks
5. Provide multiple headline options for A/B testing
6. Suggest optimal posting times based on audience analytics

Be creative, data-driven, and always focus on providing value to the audience.`,
  suggestedModel: 'claude-opus-4-5-20251101', // Use Opus for high-quality writing

  // Requirements
  requiredTools: ['browser', 'http', 'ai'],
  optionalTools: ['email', 'calendar', 'drive'],
  requiredIntegrations: [],

  // Sample workflows
  sampleWorkflows: [
    {
      id: 'blog-post-creation',
      name: 'Complete Blog Post Creation',
      description: 'Research topic, create outline, write blog post, optimize for SEO',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Research topic and gather sources',
          params: {
            query: '{{topic}} latest trends statistics',
            limit: 10,
          },
          estimatedCredits: 80,
        },
        {
          order: 2,
          tool: 'ai.summarize',
          description: 'Summarize research findings',
          params: {
            content: '{{search_results}}',
            format: 'bullet_points',
          },
          estimatedCredits: 150,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Create blog post outline',
          params: {
            prompt: 'Create a comprehensive outline for a blog post about {{topic}} based on this research: {{summary}}',
            format: 'markdown',
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'ai.generate',
          description: 'Write full blog post',
          params: {
            prompt: 'Write a 1500-word blog post following this outline: {{outline}}. Make it engaging, SEO-friendly, and include actionable insights.',
            tone: '{{brand_voice}}',
          },
          estimatedCredits: 500,
        },
        {
          order: 5,
          tool: 'ai.generate',
          description: 'Generate SEO metadata',
          params: {
            prompt: 'Create 5 headline options, meta description (155 chars), and 10 relevant keywords for this blog post: {{blog_post}}',
          },
          estimatedCredits: 100,
        },
        {
          order: 6,
          tool: 'drive.createDoc',
          description: 'Save blog post to Google Docs',
          params: {
            title: '{{headline}} - {{date}}',
            content: '{{blog_post}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'social-media-distribution',
      name: 'Social Media Content Distribution',
      description: 'Create platform-specific posts from blog content and schedule',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'ai.generate',
          description: 'Create Twitter thread',
          params: {
            prompt: 'Convert this blog post into a 5-tweet thread. Each tweet must be under 280 characters. Make it engaging with hooks and CTAs: {{blog_post}}',
          },
          estimatedCredits: 150,
        },
        {
          order: 2,
          tool: 'ai.generate',
          description: 'Create LinkedIn post',
          params: {
            prompt: 'Create a professional LinkedIn post (1300 characters max) summarizing this blog post with a strong hook and 3 key takeaways: {{blog_post}}',
          },
          estimatedCredits: 150,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Create Instagram caption',
          params: {
            prompt: 'Create an engaging Instagram caption (2200 characters max) with emojis and 10 relevant hashtags for this content: {{blog_post}}',
          },
          estimatedCredits: 100,
        },
        {
          order: 4,
          tool: 'email.send',
          description: 'Send social media content package',
          params: {
            to: '{{your_email}}',
            subject: 'Social Media Content Ready: {{topic}}',
            body: 'Twitter: {{twitter_thread}}\n\nLinkedIn: {{linkedin_post}}\n\nInstagram: {{instagram_caption}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'keyword-research',
      name: 'SEO Keyword Research',
      description: 'Research keywords, analyze competition, suggest content topics',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Search for keyword suggestions',
          params: {
            query: '{{seed_keyword}} -site:pinterest.com -site:youtube.com',
            limit: 20,
          },
          estimatedCredits: 100,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract "People Also Ask" questions',
          params: {
            selector: '.related-question-pair',
            limit: 10,
          },
          estimatedCredits: 50,
        },
        {
          order: 3,
          tool: 'ai.analyze',
          description: 'Analyze keyword difficulty and opportunities',
          params: {
            prompt: 'Analyze these search results and questions. Identify 10 low-competition, high-value keywords and suggest 5 content ideas: {{search_results}} {{questions}}',
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'drive.createSheet',
          description: 'Create keyword research spreadsheet',
          params: {
            title: 'Keyword Research - {{seed_keyword}} - {{date}}',
            data: '{{keyword_analysis}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'content-repurposing',
      name: 'Content Repurposing Engine',
      description: 'Transform existing content into multiple formats',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'ai.generate',
          description: 'Create email newsletter from blog post',
          params: {
            prompt: 'Convert this blog post into an engaging email newsletter with sections: Hook, Key Points (3), Story/Example, CTA. Max 500 words: {{blog_post}}',
          },
          estimatedCredits: 200,
        },
        {
          order: 2,
          tool: 'ai.generate',
          description: 'Create video script',
          params: {
            prompt: 'Create a 3-minute video script with intro hook, 3 main points, transitions, and outro CTA based on: {{blog_post}}',
          },
          estimatedCredits: 250,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Create infographic content',
          params: {
            prompt: 'Extract 7 key statistics/facts from this content that would work well in an infographic format: {{blog_post}}',
          },
          estimatedCredits: 150,
        },
        {
          order: 4,
          tool: 'drive.createDoc',
          description: 'Save repurposed content package',
          params: {
            title: 'Repurposed Content - {{topic}} - {{date}}',
            content: 'Newsletter: {{newsletter}}\n\nVideo Script: {{video_script}}\n\nInfographic Data: {{infographic}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
  ],

  // Custom instructions template
  customInstructionsTemplate: `Brand Guidelines:
- Brand Name: [Your brand]
- Target Audience: [Demographics and interests]
- Tone of Voice: [Professional/Casual/Friendly/Authoritative]
- Key Messaging: [Core value propositions]

Content Preferences:
- Preferred Content Length: [Word count]
- Primary Keywords: [List main keywords]
- Content Pillars: [Main topics/themes]
- Publishing Frequency: [Daily/Weekly/Monthly]

SEO Settings:
- Focus Keywords: [Primary keywords to target]
- Geographic Focus: [Local/National/Global]
- Competitor Websites: [URLs to monitor]

Distribution Channels:
- Blog URL: [Your blog]
- Social Media: [Platforms you use]
- Email List Size: [Number of subscribers]`,

  // Success metrics
  suggestedKPIs: [
    'Content pieces published per week',
    'Average SEO score (Yoast/Rank Math)',
    'Organic traffic growth percentage',
    'Social media engagement rate',
    'Time saved vs manual content creation',
    'Content repurposing efficiency',
  ],

  // Default configuration
  defaultConfig: {
    maxSteps: 30,
    maxCreditsPerTask: 1000,
    timeoutSeconds: 900, // 15 minutes for research and writing
    retryAttempts: 2,
    requireApproval: true, // Review content before publishing
  },

  // Tier and visibility
  tier: 'free', // Available to all tiers
  featured: true,
  order: 2,
};
