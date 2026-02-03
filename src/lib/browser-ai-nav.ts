/**
 * AI-Powered Browser Navigation Service
 *
 * Converts natural language commands into browser actions:
 * - "search google for hotels in Paris" → navigate + type + click
 * - "click the login button" → find and click element
 * - "fill out the form with my info" → multiple type actions
 * - "extract all product prices" → extract with selector
 */

import { aiRouter } from './ai-providers/router';
import { browserControl } from './browser-control';
import { calculateNavigationCredits } from './credits';
import { prisma } from './prisma';

export interface NavigationCommand {
  type: 'search' | 'navigate' | 'click' | 'fill_form' | 'extract' | 'scroll' | 'wait' | 'composite';
  description: string;
  actions: BrowserAction[];
  reasoning?: string;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'scroll' | 'screenshot';
  target?: string;
  selector?: string;
  value?: string;
  wait?: number;
}

export interface NavigationResult {
  success: boolean;
  command: NavigationCommand;
  results: Array<{
    action: BrowserAction;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  totalActions: number;
  successfulActions: number;
  credits: number;
  tokens: number;
  executionTime: number;
}

/**
 * Parse natural language command into structured navigation actions
 */
export async function parseCommand(
  command: string,
  currentUrl?: string,
  pageContext?: string
): Promise<NavigationCommand> {
  const systemPrompt = `You are an AI browser automation assistant. Convert user commands into structured browser actions.

AVAILABLE ACTIONS:
- navigate: Go to a URL
- click: Click an element (requires CSS selector)
- type: Type text into an input (requires CSS selector and value)
- extract: Extract data from elements (requires CSS selector)
- wait: Wait for milliseconds
- scroll: Scroll the page

OUTPUT FORMAT: JSON object with:
{
  "type": "search" | "navigate" | "click" | "fill_form" | "extract" | "scroll" | "wait" | "composite",
  "description": "human-readable description of what will happen",
  "reasoning": "brief explanation of your approach",
  "actions": [
    { "type": "navigate", "target": "https://google.com" },
    { "type": "type", "selector": "input[name='q']", "value": "hotels in Paris" },
    { "type": "click", "selector": "button[type='submit']" },
    { "type": "wait", "wait": 2000 }
  ]
}

IMPORTANT RULES:
1. Use specific, reliable CSS selectors (prefer IDs, then names, then common patterns)
2. For search commands, navigate to the search engine first
3. Add wait actions (1000-3000ms) after clicks that trigger navigation or loading
4. Keep actions simple and sequential
5. If unclear, make reasonable assumptions based on common patterns
6. For "extract" type, return a reasonable selector for the data requested

COMMON PATTERNS:
- Search: navigate to search engine → type query → click search button
- Login: type username → type password → click login button
- Form fill: multiple type actions for each field → click submit
- Click button: find button by text or common selectors`;

  const contextInfo = currentUrl
    ? `\n\nCURRENT PAGE: ${currentUrl}${pageContext ? `\n\nPAGE CONTENT SUMMARY:\n${pageContext.substring(0, 1000)}` : ''}`
    : '';

  const userPrompt = `Convert this command into browser actions:\n"${command}"${contextInfo}`;

  try {
    const response = await aiRouter.chat('claude-sonnet-4-5-20250929', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1000,
      temperature: 0.1, // Low temperature for consistent, structured output
    });

    // Parse JSON response
    let parsed: NavigationCommand;
    try {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', response.content);
      throw new Error('Failed to parse navigation command from AI response');
    }

    // Validate parsed command
    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      throw new Error('Invalid command structure: missing actions array');
    }

    return parsed;
  } catch (error) {
    console.error('Command parsing error:', error);
    throw error;
  }
}

/**
 * Execute navigation command with all actions
 */
export async function executeNavigationCommand(
  sessionId: string,
  userId: string,
  command: NavigationCommand
): Promise<NavigationResult> {
  const startTime = Date.now();
  const results: NavigationResult['results'] = [];
  let successfulActions = 0;

  for (const action of command.actions) {
    try {
      let result: any;

      switch (action.type) {
        case 'navigate':
          if (!action.target) {
            throw new Error('Navigate action requires target URL');
          }
          result = await browserControl.executeAction(sessionId, {
            type: 'navigate',
            target: action.target,
          });
          break;

        case 'click':
          if (!action.selector) {
            throw new Error('Click action requires selector');
          }
          result = await browserControl.executeAction(sessionId, {
            type: 'click',
            selector: action.selector,
          });
          break;

        case 'type':
          if (!action.selector || !action.value) {
            throw new Error('Type action requires selector and value');
          }
          result = await browserControl.executeAction(sessionId, {
            type: 'type',
            selector: action.selector,
            value: action.value,
          });
          break;

        case 'extract':
          if (!action.selector) {
            throw new Error('Extract action requires selector');
          }
          result = await browserControl.executeAction(sessionId, {
            type: 'extract',
            selector: action.selector,
          });
          break;

        case 'screenshot':
          result = await browserControl.executeAction(sessionId, {
            type: 'screenshot',
          });
          break;

        case 'wait':
          // Simple wait implementation
          await new Promise((resolve) => setTimeout(resolve, action.wait || 1000));
          result = { success: true, data: { waited: action.wait || 1000 } };
          break;

        case 'scroll':
          // Execute scroll via evaluate
          result = await browserControl.executeAction(sessionId, {
            type: 'evaluate',
            code: action.value || 'window.scrollTo(0, document.body.scrollHeight)',
          });
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      if (result.success) {
        successfulActions++;
      }

      results.push({
        action,
        success: result.success,
        data: result.data,
        error: result.error,
      });

      // Stop execution if action failed
      if (!result.success) {
        break;
      }
    } catch (error: any) {
      results.push({
        action,
        success: false,
        error: error.message,
      });
      break; // Stop on error
    }
  }

  const executionTime = Date.now() - startTime;

  // Calculate credits (parsing + execution)
  const credits = calculateNavigationCredits(command.actions.length);

  // Log navigation execution
  await prisma.usageRecord.create({
    data: {
      userId,
      type: 'ai_navigation',
      credits,
      metadata: {
        command: command.description,
        actions: command.actions.length,
        successfulActions,
        executionTime,
      },
    },
  });

  // Update user credits
  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: { increment: credits },
    },
  });

  return {
    success: successfulActions === command.actions.length,
    command,
    results,
    totalActions: command.actions.length,
    successfulActions,
    credits,
    tokens: 0, // Will be updated by API route
    executionTime,
  };
}

/**
 * Get example commands for UI
 */
export function getExampleCommands(): Array<{ label: string; command: string; description: string }> {
  return [
    {
      label: 'Search Google',
      command: 'search google for latest news about AI',
      description: 'Navigate to Google and search for a topic',
    },
    {
      label: 'Click Element',
      command: 'click the login button',
      description: 'Find and click an element on the page',
    },
    {
      label: 'Extract Data',
      command: 'extract all article headlines from this page',
      description: 'Extract specific data using selectors',
    },
    {
      label: 'Fill Form',
      command: 'fill the email field with test@example.com',
      description: 'Type text into form fields',
    },
    {
      label: 'Navigate',
      command: 'go to wikipedia.org',
      description: 'Navigate to a specific URL',
    },
    {
      label: 'Multi-Step',
      command: 'go to github.com, click sign in, and take a screenshot',
      description: 'Execute multiple actions in sequence',
    },
  ];
}

/**
 * Validate command before execution
 */
export function validateCommand(command: string): { valid: boolean; error?: string } {
  if (!command || command.trim().length === 0) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  if (command.length > 500) {
    return { valid: false, error: 'Command too long (max 500 characters)' };
  }

  // Check for potentially dangerous commands
  const dangerousPatterns = [
    /delete.*database/i,
    /drop.*table/i,
    /rm\s+-rf/i,
    /format.*drive/i,
    /execute.*script/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, error: 'Command contains potentially dangerous operations' };
    }
  }

  return { valid: true };
}

/**
 * Get command history for a user
 */
export async function getCommandHistory(userId: string, limit: number = 10) {
  const history = await prisma.usageRecord.findMany({
    where: {
      userId,
      type: 'ai_navigation',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return history.map((record) => ({
    id: record.id,
    command: (record.metadata as any)?.command || 'Unknown command',
    actions: (record.metadata as any)?.actions || 0,
    successfulActions: (record.metadata as any)?.successfulActions || 0,
    credits: record.credits,
    createdAt: record.createdAt,
  }));
}
