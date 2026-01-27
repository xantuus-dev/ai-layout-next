/**
 * Competitor Price Monitor Workflow
 *
 * Automatically checks competitor pricing and alerts when prices drop below threshold.
 * This is a pre-built workflow template that users can easily configure.
 */

import { AgentTask, AgentConfig, ExecutionPlan, ExecutionStep } from '../types';

export interface CompetitorPriceMonitorConfig {
  competitorUrl: string;          // URL of competitor's pricing page
  priceSelector: string;          // CSS selector for price element
  thresholdPrice: number;         // Alert if price goes below this
  alertEmail: string;             // Email to send alerts to
  checkFrequency?: 'daily' | 'weekly' | 'hourly'; // How often to check
  checkTime?: string;             // When to run (e.g., "09:00")
}

/**
 * Create a pre-configured execution plan for price monitoring
 * This bypasses the AI planner for faster, more reliable execution
 */
export function createPriceMonitorPlan(
  taskId: string,
  config: CompetitorPriceMonitorConfig
): ExecutionPlan {
  const steps: ExecutionStep[] = [
    {
      id: `${taskId}_step_1`,
      stepNumber: 1,
      action: 'browser.navigate',
      description: `Navigate to ${config.competitorUrl}`,
      tool: 'browser',
      params: {
        url: config.competitorUrl,
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 10,
      estimatedDuration: 3000,
    },
    {
      id: `${taskId}_step_2`,
      stepNumber: 2,
      action: 'browser.waitFor',
      description: 'Wait for price element to load',
      tool: 'browser',
      params: {
        selector: config.priceSelector,
        timeout: 10000,
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 5,
      estimatedDuration: 2000,
    },
    {
      id: `${taskId}_step_3`,
      stepNumber: 3,
      action: 'browser.extract',
      description: 'Extract competitor price',
      tool: 'browser',
      params: {
        selector: config.priceSelector,
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 10,
      estimatedDuration: 500,
    },
    {
      id: `${taskId}_step_4`,
      stepNumber: 4,
      action: 'browser.screenshot',
      description: 'Capture screenshot for verification',
      tool: 'browser',
      params: {},
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 15,
      estimatedDuration: 1000,
    },
    {
      id: `${taskId}_step_5`,
      stepNumber: 5,
      action: 'ai.extract',
      description: 'Parse price value from extracted text',
      tool: 'ai',
      params: {
        text: '{{step3.result.text}}',
        schema: {
          price: 'The numeric price value (just the number, no currency symbol)',
          currency: 'The currency symbol or code (e.g., $, USD)',
          fullText: 'The complete price text as shown',
        },
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 100,
      estimatedDuration: 2000,
    },
    {
      id: `${taskId}_step_6`,
      stepNumber: 6,
      action: 'ai.chat',
      description: 'Determine if alert should be sent',
      tool: 'ai',
      params: {
        prompt: `Compare the competitor's price to the threshold and determine if an alert should be sent.

Competitor Price: {{step5.result.extracted.price}}
Threshold Price: ${config.thresholdPrice}

If the competitor's price is LOWER than the threshold, respond with: YES
If the competitor's price is HIGHER OR EQUAL to the threshold, respond with: NO

Only respond with YES or NO, nothing else.`,
        model: 'claude-haiku-4-5-20250529', // Use cheap model for simple comparison
        maxTokens: 10,
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 50,
      estimatedDuration: 1500,
    },
    {
      id: `${taskId}_step_7`,
      stepNumber: 7,
      action: 'email.send',
      description: 'Send price alert email (conditional)',
      tool: 'email',
      params: {
        to: config.alertEmail,
        subject: `🚨 Competitor Price Alert: Price Drop Detected`,
        body: `Hello,

Your competitor's price has dropped below your threshold!

🎯 Your Threshold: $${config.thresholdPrice}
💰 Competitor's Price: {{step5.result.extracted.price}} {{step5.result.extracted.currency}}
📍 Page: ${config.competitorUrl}
📅 Checked: {{timestamp}}

Full Price Text: {{step5.result.extracted.fullText}}

This is an automated alert from your Xantuus AI price monitoring agent.

---
🤖 Powered by Xantuus AI
Manage your agents: https://app.xantuus.com/workspace/agents`,
      },
      retryable: true,
      requiresApproval: false,
      estimatedCredits: 10,
      estimatedDuration: 2000,
      dependencies: [`${taskId}_step_6`], // Only run if step 6 says YES
    },
  ];

  return {
    taskId,
    steps,
    totalSteps: steps.length,
    estimatedCredits: steps.reduce((sum, step) => sum + (step.estimatedCredits || 0), 0),
    estimatedDuration: steps.reduce((sum, step) => sum + (step.estimatedDuration || 0), 0),
    createdAt: new Date(),
    metadata: {
      workflowType: 'competitor_price_monitor',
      config,
    },
  };
}

/**
 * Create agent task for price monitoring
 */
export function createPriceMonitorTask(
  userId: string,
  config: CompetitorPriceMonitorConfig
): Omit<AgentTask, 'id' | 'createdAt'> {
  return {
    userId,
    type: 'browser_automation',
    goal: `Monitor ${config.competitorUrl} for price changes. Alert ${config.alertEmail} if price drops below $${config.thresholdPrice}.`,
    config: {
      model: 'claude-sonnet-4-5-20250929',
      maxSteps: 10,
      timeout: 60000, // 1 minute
      retryCount: 2,
      requireApproval: false,
    },
    context: {
      workflowType: 'competitor_price_monitor',
      ...config,
    },
  };
}

/**
 * Validate competitor price monitor configuration
 */
export function validatePriceMonitorConfig(
  config: Partial<CompetitorPriceMonitorConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate URL
  if (!config.competitorUrl) {
    errors.push('Competitor URL is required');
  } else {
    try {
      new URL(config.competitorUrl);
    } catch {
      errors.push('Invalid competitor URL format');
    }
  }

  // Validate selector
  if (!config.priceSelector) {
    errors.push('Price selector is required (CSS selector)');
  } else if (config.priceSelector.length < 2) {
    errors.push('Price selector is too short');
  }

  // Validate threshold
  if (config.thresholdPrice === undefined || config.thresholdPrice === null) {
    errors.push('Threshold price is required');
  } else if (typeof config.thresholdPrice !== 'number') {
    errors.push('Threshold price must be a number');
  } else if (config.thresholdPrice <= 0) {
    errors.push('Threshold price must be greater than 0');
  }

  // Validate email
  if (!config.alertEmail) {
    errors.push('Alert email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.alertEmail)) {
      errors.push('Invalid email format');
    }
  }

  // Validate frequency (optional)
  if (config.checkFrequency && !['daily', 'weekly', 'hourly'].includes(config.checkFrequency)) {
    errors.push('Check frequency must be daily, weekly, or hourly');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse price from text (fallback if AI extraction fails)
 */
export function parsePrice(text: string): { price: number; currency: string } | null {
  // Remove whitespace
  const cleaned = text.trim().replace(/\s+/g, ' ');

  // Try to find price patterns
  const patterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,           // $99.99 or $1,234.56
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*\$/,           // 99.99$ or 1,234.56$
    /USD\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,         // USD 99.99
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*USD/i,         // 99.99 USD
    /€\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,            // €99.99
    /£\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,            // £99.99
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);

      if (!isNaN(price)) {
        // Detect currency
        let currency = '$';
        if (cleaned.includes('€')) currency = '€';
        else if (cleaned.includes('£')) currency = '£';
        else if (cleaned.toLowerCase().includes('usd')) currency = 'USD';
        else if (cleaned.toLowerCase().includes('eur')) currency = 'EUR';
        else if (cleaned.toLowerCase().includes('gbp')) currency = 'GBP';

        return { price, currency };
      }
    }
  }

  return null;
}

/**
 * Estimate workflow cost
 */
export function estimatePriceMonitorCost(): {
  creditsPerRun: number;
  runsPerMonth: number;
  totalMonthly: number;
} {
  const creditsPerRun = 200; // ~200 credits per check

  return {
    creditsPerRun,
    runsPerMonth: 30, // Daily checks
    totalMonthly: creditsPerRun * 30, // 6,000 credits/month
  };
}
