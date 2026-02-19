/**
 * E-commerce Store Manager Template
 *
 * AI agent for managing e-commerce operations including price monitoring,
 * inventory alerts, competitor analysis, and customer support.
 */

import { VerticalTemplate } from './types';

export const ecommerceManagerTemplate: VerticalTemplate = {
  // Identity
  name: 'E-commerce Store Manager',
  description: 'Automate your online store operations with AI-powered price monitoring, inventory management, competitor tracking, and customer engagement. Perfect for Shopify, Amazon, and other e-commerce platforms.',
  industry: 'ecommerce',
  icon: '🛍️',
  color: '#10B981', // Green

  // Agent configuration
  agentType: 'browser_automation',
  systemPrompt: `You are an E-commerce Store Manager AI assistant specialized in managing online retail operations.

Your core responsibilities:
- Monitor competitor prices and adjust pricing strategies
- Track inventory levels and alert on low stock
- Analyze product performance and recommend optimizations
- Monitor customer reviews and sentiment
- Generate product descriptions and marketing copy
- Track shipping and fulfillment issues
- Provide sales analytics and insights

You have access to browser automation, email, and data processing tools. When monitoring websites:
1. Extract clean, structured data
2. Compare current data with historical baselines
3. Alert on significant changes (price drops, stock issues, negative reviews)
4. Provide actionable recommendations

Be proactive, detail-oriented, and always focus on maximizing revenue while maintaining customer satisfaction.`,
  suggestedModel: 'claude-sonnet-4-5-20250929',

  // Requirements
  requiredTools: ['browser', 'http', 'data'],
  optionalTools: ['email', 'ai'],
  requiredIntegrations: [],

  // Sample workflows
  sampleWorkflows: [
    {
      id: 'competitor-price-monitor',
      name: 'Competitor Price Monitoring',
      description: 'Monitor competitor product prices and alert when prices drop below yours',
      trigger: 'scheduled',
      schedule: '0 */6 * * *', // Every 6 hours
      steps: [
        {
          order: 1,
          tool: 'browser.navigate',
          description: 'Navigate to competitor product page',
          params: {
            url: '{{competitor_url}}',
            waitFor: 'networkidle',
          },
          estimatedCredits: 50,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract product price and availability',
          params: {
            selectors: {
              price: '{{price_selector}}',
              availability: '{{stock_selector}}',
              title: 'h1',
            },
          },
          estimatedCredits: 30,
        },
        {
          order: 3,
          tool: 'data.compare',
          description: 'Compare with your pricing',
          params: {
            operation: 'compare_price',
            your_price: '{{your_price}}',
            competitor_price: '{{extracted_price}}',
          },
          estimatedCredits: 10,
        },
        {
          order: 4,
          tool: 'email.send',
          description: 'Send alert if competitor price is lower',
          params: {
            to: '{{owner_email}}',
            subject: 'Price Alert: Competitor Undercut on {{product_name}}',
            body: 'Competitor is selling {{product_name}} for {{competitor_price}} (Your price: {{your_price}}). Consider adjusting your pricing.',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'inventory-check',
      name: 'Inventory Level Check',
      description: 'Monitor inventory levels and alert on low stock',
      trigger: 'scheduled',
      schedule: '0 9 * * *', // Daily at 9 AM
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch inventory data from your platform',
          params: {
            url: '{{inventory_api_endpoint}}',
            headers: {
              Authorization: 'Bearer {{api_key}}',
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'data.filter',
          description: 'Filter products with low stock',
          params: {
            condition: 'quantity < {{low_stock_threshold}}',
          },
          estimatedCredits: 10,
        },
        {
          order: 3,
          tool: 'email.send',
          description: 'Send low stock alert',
          params: {
            to: '{{owner_email}}',
            subject: 'Low Stock Alert: {{product_count}} Products Need Restocking',
            body: 'The following products are running low:\n{{product_list}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'review-monitoring',
      name: 'Customer Review Monitoring',
      description: 'Monitor new reviews and analyze sentiment',
      trigger: 'scheduled',
      schedule: '0 */4 * * *', // Every 4 hours
      steps: [
        {
          order: 1,
          tool: 'browser.navigate',
          description: 'Navigate to product reviews page',
          params: {
            url: '{{reviews_url}}',
          },
          estimatedCredits: 50,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract recent reviews',
          params: {
            selector: '{{review_selector}}',
            limit: 10,
          },
          estimatedCredits: 40,
        },
        {
          order: 3,
          tool: 'ai.analyze',
          description: 'Analyze review sentiment',
          params: {
            prompt: 'Analyze the sentiment of these reviews and identify any recurring issues or complaints:\n{{reviews}}',
          },
          estimatedCredits: 100,
        },
        {
          order: 4,
          tool: 'email.send',
          description: 'Send review summary with insights',
          params: {
            to: '{{owner_email}}',
            subject: 'Daily Review Summary - {{date}}',
            body: '{{ai_analysis}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
  ],

  // Custom instructions template
  customInstructionsTemplate: `Store Details:
- Store Name: [Your store name]
- Platform: [Shopify/Amazon/WooCommerce/Custom]
- Primary Products: [Product categories]
- Target Market: [Geographic/demographic]

Monitoring Preferences:
- Competitor URLs: [List competitor websites]
- Low Stock Threshold: [Number of units]
- Price Alert Threshold: [Percentage difference]

Notification Settings:
- Email: [Your email]
- Slack Channel: [Channel ID if integrated]
- Alert Frequency: [Immediate/Daily digest/Weekly summary]`,

  // Success metrics
  suggestedKPIs: [
    'Number of price alerts triggered',
    'Inventory issues prevented',
    'Revenue protected from competitor underpricing',
    'Customer review response time',
    'Product listing optimization score',
  ],

  // Default configuration
  defaultConfig: {
    maxSteps: 25,
    maxCreditsPerTask: 500,
    timeoutSeconds: 600, // 10 minutes for web scraping
    retryAttempts: 3,
    requireApproval: false,
  },

  // Tier and visibility
  tier: 'free', // Available to all tiers
  featured: true,
  order: 1,
};
