/**
 * Browser Tool - Web automation and scraping
 *
 * Wraps existing Puppeteer browser control for agent use
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { browserControl } from '@/lib/browser-control';

/**
 * Navigate to a URL
 */
export class BrowserNavigateTool implements AgentTool {
  name = 'browser.navigate';
  description = 'Navigate to a web page URL';
  category = 'browser' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.url || typeof params.url !== 'string') {
      return { valid: false, error: 'url parameter required (string)' };
    }

    try {
      new URL(params.url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  async execute(params: { url: string }, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[Browser] Navigating to ${params.url}`);

      // Create browser session
      const sessionId = await browserControl.createSession(context.userId);

      try {
        // Execute navigation
        const result = await browserControl.executeAction(sessionId, {
          type: 'navigate',
          target: params.url,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Navigation failed',
            metadata: {
              duration: Date.now() - startTime,
              credits: 25,
            },
          };
        }

        return {
          success: true,
          data: {
            url: result.data?.url || params.url,
            status: 'loaded',
            html: result.html,
            securityWarnings: result.securityWarnings,
          },
          metadata: {
            duration: Date.now() - startTime,
            credits: 25,
          },
        };
      } finally {
        // Always cleanup session
        await browserControl.closeSession(sessionId);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 25,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10; // Credits per navigation
  }
}

/**
 * Extract text from page using CSS selector
 */
export class BrowserExtractTool implements AgentTool {
  name = 'browser.extract';
  description = 'Extract text content from the current page using a CSS selector';
  category = 'browser' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.selector || typeof params.selector !== 'string') {
      return { valid: false, error: 'selector parameter required (string)' };
    }
    return { valid: true };
  }

  async execute(params: { selector: string; url?: string }, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[Browser] Extracting: ${params.selector}`);

      // Create browser session
      const sessionId = await browserControl.createSession(context.userId);

      try {
        // Navigate first if URL provided
        if (params.url) {
          await browserControl.executeAction(sessionId, {
            type: 'navigate',
            target: params.url,
          });
        }

        // Extract content
        const result = await browserControl.executeAction(sessionId, {
          type: 'extract',
          selector: params.selector,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Extraction failed',
            metadata: {
              duration: Date.now() - startTime,
              credits: 15,
            },
          };
        }

        return {
          success: true,
          data: {
            selector: params.selector,
            text: result.data?.extracted || '',
            securityWarnings: result.securityWarnings,
          },
          metadata: {
            duration: Date.now() - startTime,
            credits: 15,
          },
        };
      } finally {
        await browserControl.closeSession(sessionId);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 15,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10;
  }
}

/**
 * Click an element on the page
 */
export class BrowserClickTool implements AgentTool {
  name = 'browser.click';
  description = 'Click an element on the current page using a CSS selector';
  category = 'browser' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.selector || typeof params.selector !== 'string') {
      return { valid: false, error: 'selector parameter required (string)' };
    }
    return { valid: true };
  }

  async execute(params: { selector: string; url?: string }, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[Browser] Clicking: ${params.selector}`);

      // Create browser session
      const sessionId = await browserControl.createSession(context.userId);

      try {
        // Navigate first if URL provided
        if (params.url) {
          await browserControl.executeAction(sessionId, {
            type: 'navigate',
            target: params.url,
          });
        }

        // Click element
        const result = await browserControl.executeAction(sessionId, {
          type: 'click',
          selector: params.selector,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Click failed',
            metadata: {
              duration: Date.now() - startTime,
              credits: 10,
            },
          };
        }

        return {
          success: true,
          data: {
            selector: params.selector,
            clicked: true,
            securityWarnings: result.securityWarnings,
          },
          metadata: {
            duration: Date.now() - startTime,
            credits: 10,
          },
        };
      } finally {
        await browserControl.closeSession(sessionId);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 5;
  }
}

/**
 * Take a screenshot of the current page
 */
export class BrowserScreenshotTool implements AgentTool {
  name = 'browser.screenshot';
  description = 'Capture a screenshot of the current page';
  category = 'browser' as const;

  validate(params: any): { valid: boolean; error?: string } {
    return { valid: true };
  }

  async execute(params: { url?: string }, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[Browser] Taking screenshot`);

      // Create browser session
      const sessionId = await browserControl.createSession(context.userId);

      try {
        // Navigate first if URL provided
        if (params.url) {
          await browserControl.executeAction(sessionId, {
            type: 'navigate',
            target: params.url,
          });
        }

        // Take screenshot
        const result = await browserControl.executeAction(sessionId, {
          type: 'screenshot',
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Screenshot failed',
            metadata: {
              duration: Date.now() - startTime,
              credits: 20,
            },
          };
        }

        return {
          success: true,
          data: {
            screenshot: result.screenshot,
            format: 'png',
            securityWarnings: result.securityWarnings,
          },
          metadata: {
            duration: Date.now() - startTime,
            credits: 20,
          },
        };
      } finally {
        await browserControl.closeSession(sessionId);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 20,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 15;
  }
}

/**
 * Wait for an element to appear
 */
export class BrowserWaitForTool implements AgentTool {
  name = 'browser.waitFor';
  description = 'Wait for an element to appear on the page';
  category = 'browser' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.selector || typeof params.selector !== 'string') {
      return { valid: false, error: 'selector parameter required (string)' };
    }
    return { valid: true };
  }

  async execute(
    params: { selector: string; timeout?: number; url?: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const timeout = params.timeout || 30000;

    try {
      console.log(`[Browser] Waiting for: ${params.selector}`);

      // Create browser session
      const sessionId = await browserControl.createSession(context.userId);

      try {
        // Navigate first if URL provided
        if (params.url) {
          await browserControl.executeAction(sessionId, {
            type: 'navigate',
            target: params.url,
          });
        }

        // Wait for element by repeatedly trying to extract it
        const checkInterval = 500; // Check every 500ms
        const maxAttempts = Math.floor(timeout / checkInterval);
        let appeared = false;

        for (let i = 0; i < maxAttempts; i++) {
          const result = await browserControl.executeAction(sessionId, {
            type: 'extract',
            selector: params.selector,
          });

          if (result.success && result.data?.extracted) {
            appeared = true;
            break;
          }

          // Wait before next attempt
          if (i < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
          }
        }

        if (!appeared) {
          return {
            success: false,
            error: `Element ${params.selector} did not appear within ${timeout}ms`,
            metadata: {
              duration: Date.now() - startTime,
              credits: 5,
            },
          };
        }

        return {
          success: true,
          data: {
            selector: params.selector,
            appeared: true,
          },
          metadata: {
            duration: Date.now() - startTime,
            credits: 5,
          },
        };
      } finally {
        await browserControl.closeSession(sessionId);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 5,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 5;
  }
}
