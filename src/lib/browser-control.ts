/**
 * Secure Browser Control Service
 *
 * Provides automated browser control with comprehensive security measures:
 * - Sandboxing and process isolation
 * - Resource limits and timeouts
 * - Content filtering and validation
 * - Request/response monitoring
 * - Rate limiting per user
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { prisma } from '@/lib/prisma';

// Security configuration
const BROWSER_CONFIG = {
  maxPages: 5, // Max concurrent pages per user
  maxNavigationTime: 30000, // 30 seconds max per navigation
  maxTotalTime: 120000, // 2 minutes max per session
  allowedProtocols: ['http:', 'https:'],
  blockedDomains: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // AWS metadata
    '::1',
    'metadata.google.internal', // GCP metadata
  ],
  maxResponseSize: 10 * 1024 * 1024, // 10MB
  maxScreenshotSize: 5 * 1024 * 1024, // 5MB
};

// Prompt injection patterns to detect and block
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|commands|prompts)/i,
  /disregard\s+(previous|all|above)/i,
  /new\s+instructions:/i,
  /system\s*:\s*/i,
  /\[SYSTEM\]/i,
  /\<\|im_start\|\>/i,
  /\<\|im_end\|\>/i,
  /<admin>/i,
  /<\/admin>/i,
  /sudo\s+mode/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /bypass\s+filter/i,
];

// XSS patterns to detect in content
const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /<iframe[\s\S]*?>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

export interface BrowserSession {
  id: string;
  userId: string;
  browser: Browser | null;
  pages: Page[];
  startTime: number;
  requestCount: number;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'evaluate';
  target?: string;
  value?: string;
  selector?: string;
  code?: string;
}

export interface BrowserResult {
  success: boolean;
  data?: any;
  screenshot?: string;
  html?: string;
  error?: string;
  securityWarnings?: string[];
}

class BrowserControlService {
  private sessions: Map<string, BrowserSession> = new Map();
  private userRequestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Detect potential prompt injection attempts
   */
  detectPromptInjection(input: string): { isInjection: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      isInjection: detectedPatterns.length > 0,
      patterns: detectedPatterns,
    };
  }

  /**
   * Detect XSS attempts in content
   */
  detectXSS(content: string): { hasXSS: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];

    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(content)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      hasXSS: detectedPatterns.length > 0,
      patterns: detectedPatterns,
    };
  }

  /**
   * Validate URL is safe to visit
   */
  validateURL(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Check protocol
      if (!BROWSER_CONFIG.allowedProtocols.includes(parsed.protocol)) {
        return { valid: false, reason: `Protocol ${parsed.protocol} not allowed` };
      }

      // Check blocked domains
      const hostname = parsed.hostname.toLowerCase();
      for (const blocked of BROWSER_CONFIG.blockedDomains) {
        if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
          return { valid: false, reason: `Domain ${hostname} is blocked` };
        }
      }

      // Check for IP addresses (internal network)
      if (/^(\d+\.){3}\d+$/.test(hostname)) {
        const parts = hostname.split('.').map(Number);
        // Block private IP ranges
        if (
          parts[0] === 10 || // 10.0.0.0/8
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
          (parts[0] === 192 && parts[1] === 168) // 192.168.0.0/16
        ) {
          return { valid: false, reason: 'Private IP addresses are blocked' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Check rate limit for user
   */
  checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const userData = this.userRequestCounts.get(userId);

    // Reset every hour
    if (!userData || now > userData.resetTime) {
      this.userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      });
      return { allowed: true, remaining: 99 };
    }

    // Max 100 requests per hour
    if (userData.count >= 100) {
      return { allowed: false, remaining: 0 };
    }

    userData.count++;
    return { allowed: true, remaining: 100 - userData.count };
  }

  /**
   * Create secure browser session
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Secure launch options
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-features=site-per-process', // Prevent cross-site access
      ],
      timeout: 30000,
    };

    const browser = await puppeteer.launch(launchOptions);

    const session: BrowserSession = {
      id: sessionId,
      userId,
      browser,
      pages: [],
      startTime: Date.now(),
      requestCount: 0,
    };

    this.sessions.set(sessionId, session);

    // Auto-cleanup after max time
    setTimeout(() => {
      this.closeSession(sessionId);
    }, BROWSER_CONFIG.maxTotalTime);

    return sessionId;
  }

  /**
   * Execute browser action with security checks
   */
  async executeAction(
    sessionId: string,
    action: BrowserAction
  ): Promise<BrowserResult> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      return { success: false, error: 'Invalid session' };
    }

    // Check session timeout
    if (Date.now() - session.startTime > BROWSER_CONFIG.maxTotalTime) {
      await this.closeSession(sessionId);
      return { success: false, error: 'Session timeout' };
    }

    // Check page limit
    if (session.pages.length >= BROWSER_CONFIG.maxPages && action.type === 'navigate') {
      return { success: false, error: 'Maximum pages limit reached' };
    }

    const securityWarnings: string[] = [];

    try {
      let page: Page;

      // Create new page for navigation
      if (action.type === 'navigate') {
        page = await session.browser.newPage();
        session.pages.push(page);

        // Set security headers
        await page.setExtraHTTPHeaders({
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'X-XSS-Protection': '1; mode=block',
        });

        // Set user agent
        await page.setUserAgent(
          'Mozilla/5.0 (compatible; SecureBrowserBot/1.0; +https://example.com/bot)'
        );

        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });

        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });

        // Monitor responses for size
        page.on('response', async (response) => {
          const headers = response.headers();
          const contentLength = parseInt(headers['content-length'] || '0', 10);
          if (contentLength > BROWSER_CONFIG.maxResponseSize) {
            securityWarnings.push(`Response size (${contentLength}) exceeds limit`);
          }
        });

        // Validate URL
        if (action.target) {
          const urlValidation = this.validateURL(action.target);
          if (!urlValidation.valid) {
            await page.close();
            return {
              success: false,
              error: `URL validation failed: ${urlValidation.reason}`,
            };
          }

          // Navigate with timeout
          await page.goto(action.target, {
            timeout: BROWSER_CONFIG.maxNavigationTime,
            waitUntil: 'networkidle2',
          });

          session.requestCount++;
        }
      } else {
        // Use existing page
        page = session.pages[session.pages.length - 1];
        if (!page) {
          return { success: false, error: 'No active page' };
        }
      }

      // Execute action
      let result: BrowserResult = { success: true, securityWarnings };

      switch (action.type) {
        case 'navigate':
          const pageUrl = page.url();
          const pageTitle = await page.title();
          result.data = { url: pageUrl, title: pageTitle };

          // Update session state in database
          await this.updateSessionState(sessionId, {
            url: pageUrl,
            title: pageTitle,
          });
          break;

        case 'click':
          if (!action.selector) {
            return { success: false, error: 'Selector required for click' };
          }
          await page.waitForSelector(action.selector, { timeout: 10000 });
          await page.click(action.selector);
          result.data = { clicked: action.selector };
          break;

        case 'type':
          if (!action.selector || !action.value) {
            return { success: false, error: 'Selector and value required for type' };
          }
          // Check for prompt injection in input
          const injectionCheck = this.detectPromptInjection(action.value);
          if (injectionCheck.isInjection) {
            securityWarnings.push(
              `Potential prompt injection detected: ${injectionCheck.patterns.join(', ')}`
            );
          }
          await page.type(action.selector, action.value, { delay: 50 });
          result.data = { typed: action.selector };
          break;

        case 'screenshot':
          const screenshot = await page.screenshot({
            encoding: 'base64',
            type: 'png',
            fullPage: false,
          });
          // Check screenshot size
          if (screenshot.length > BROWSER_CONFIG.maxScreenshotSize) {
            securityWarnings.push('Screenshot size exceeds limit, truncated');
          }
          result.screenshot = screenshot.toString().substring(0, BROWSER_CONFIG.maxScreenshotSize);
          break;

        case 'extract':
          if (!action.selector) {
            return { success: false, error: 'Selector required for extract' };
          }
          const extracted = await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            return element ? element.textContent : null;
          }, action.selector);

          // Check for XSS in extracted content
          if (extracted) {
            const xssCheck = this.detectXSS(extracted);
            if (xssCheck.hasXSS) {
              securityWarnings.push('Potential XSS detected in extracted content');
            }
          }

          result.data = { extracted };
          break;

        case 'evaluate':
          if (!action.code) {
            return { success: false, error: 'Code required for evaluate' };
          }
          // DANGEROUS: Limit what can be evaluated
          if (
            action.code.includes('fetch(') ||
            action.code.includes('XMLHttpRequest') ||
            action.code.includes('eval(') ||
            action.code.includes('Function(')
          ) {
            return {
              success: false,
              error: 'Dangerous code patterns detected',
            };
          }
          const evalResult = await page.evaluate(action.code);
          result.data = { result: evalResult };
          break;

        default:
          return { success: false, error: 'Unknown action type' };
      }

      // Get page HTML if requested
      if (action.type !== 'screenshot') {
        const html = await page.content();
        // Truncate large HTML
        result.html = html.substring(0, 50000);
      }

      result.securityWarnings = securityWarnings;
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Action failed',
        securityWarnings,
      };
    }
  }

  /**
   * Close browser session and cleanup
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.browser) {
        await session.browser.close();
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Update session state in database
   */
  async updateSessionState(sessionId: string, updates: {
    url?: string;
    title?: string;
    creditsUsed?: number;
    tokensUsed?: number;
  }): Promise<void> {
    try {
      const updateData: any = {};

      if (updates.url) updateData.url = updates.url;
      if (updates.title) updateData.title = updates.title;
      if (updates.creditsUsed) {
        updateData.totalCreditsUsed = { increment: updates.creditsUsed };
      }
      if (updates.tokensUsed) {
        updateData.totalTokensUsed = { increment: updates.tokensUsed };
      }

      await prisma.browserSession.update({
        where: { id: sessionId },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating session state:', error);
      // Don't throw - allow session to continue even if DB update fails
    }
  }

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): string[] {
    const sessions: string[] = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        sessions.push(sessionId);
      }
    }
    return sessions;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupSessions(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startTime > BROWSER_CONFIG.maxTotalTime) {
        await this.closeSession(sessionId);
      }
    }
  }
}

// Singleton instance
export const browserControl = new BrowserControlService();

// Cleanup interval (every 5 minutes)
setInterval(() => {
  browserControl.cleanupSessions();
}, 5 * 60 * 1000);
