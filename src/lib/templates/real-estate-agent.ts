/**
 * Real Estate Agent Template
 *
 * AI agent for real estate professionals to automate lead generation,
 * property monitoring, client communication, and market research.
 */

import { VerticalTemplate } from './types';

export const realEstateAgentTemplate: VerticalTemplate = {
  // Identity
  name: 'Real Estate Agent Assistant',
  description: 'Automate your real estate business with AI-powered listing monitoring, lead nurturing, market analysis, and client communication. Perfect for residential and commercial agents.',
  industry: 'real-estate',
  icon: '🏠',
  color: '#EF4444', // Red

  // Agent configuration
  agentType: 'browser_automation',
  systemPrompt: `You are a Real Estate Agent Assistant AI specialized in helping real estate professionals manage their business more efficiently.

Your core responsibilities:
- Monitor new property listings matching client criteria
- Track price changes and market trends
- Generate property comparison reports
- Nurture leads with personalized follow-ups
- Schedule property viewings and open houses
- Research neighborhood data and market statistics
- Draft listing descriptions and marketing materials
- Analyze comparable sales (comps) for pricing guidance

You have access to browser automation, email, and calendar tools. When working with properties:
1. Extract clean property data (price, beds, baths, sqft, features)
2. Compare properties against client requirements
3. Calculate price per square foot and value metrics
4. Research neighborhood amenities, schools, and demographics
5. Provide data-driven insights and recommendations

Be professional, detail-oriented, and always act in the client's best interest. Focus on finding the perfect property match and providing exceptional service.`,
  suggestedModel: 'claude-sonnet-4-5-20250929',

  // Requirements
  requiredTools: ['browser', 'http', 'email'],
  optionalTools: ['calendar', 'ai', 'drive'],
  requiredIntegrations: [],

  // Sample workflows
  sampleWorkflows: [
    {
      id: 'listing-monitor',
      name: 'New Listing Monitor',
      description: 'Monitor real estate websites for new listings matching client criteria',
      trigger: 'scheduled',
      schedule: '0 */2 * * *', // Every 2 hours
      steps: [
        {
          order: 1,
          tool: 'browser.navigate',
          description: 'Navigate to real estate website search',
          params: {
            url: '{{search_url}}', // e.g., Zillow, Realtor.com, Redfin
          },
          estimatedCredits: 50,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract new listing details',
          params: {
            selectors: {
              listings: '.property-card',
              price: '[data-label="pc-price"]',
              address: '[data-label="pc-address"]',
              beds: '[data-label="pc-beds"]',
              baths: '[data-label="pc-baths"]',
              sqft: '[data-label="pc-sqft"]',
              link: 'a[href]',
            },
            limit: 20,
          },
          estimatedCredits: 80,
        },
        {
          order: 3,
          tool: 'data.filter',
          description: 'Filter listings by client criteria',
          params: {
            conditions: {
              price: {min: '{{min_price}}', max: '{{max_price}}'},
              beds: {min: '{{min_beds}}'},
              baths: {min: '{{min_baths}}'},
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 4,
          tool: 'email.send',
          description: 'Send new listings to client',
          params: {
            to: '{{client_email}}',
            subject: 'New Properties Matching Your Criteria - {{date}}',
            body: 'Hi {{client_name}},\n\nI found {{count}} new properties that match what you\'re looking for:\n\n{{listings_formatted}}\n\nLet me know if you\'d like to schedule viewings!\n\nBest,\n{{agent_name}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'price-drop-alert',
      name: 'Price Drop Alert',
      description: 'Monitor saved properties for price reductions',
      trigger: 'scheduled',
      schedule: '0 9 * * *', // Daily at 9 AM
      steps: [
        {
          order: 1,
          tool: 'browser.navigate',
          description: 'Check each saved property URL',
          params: {
            urls: '{{saved_property_urls}}',
          },
          estimatedCredits: 100,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract current price',
          params: {
            selector: '{{price_selector}}',
          },
          estimatedCredits: 40,
        },
        {
          order: 3,
          tool: 'data.compare',
          description: 'Compare with last known price',
          params: {
            operation: 'price_change',
            previous_prices: '{{price_history}}',
            current_prices: '{{extracted_prices}}',
          },
          estimatedCredits: 20,
        },
        {
          order: 4,
          tool: 'email.send',
          description: 'Alert on price drops',
          params: {
            to: '{{client_email}}',
            subject: 'Price Drop Alert: {{property_address}}',
            body: 'Great news! The property at {{address}} just dropped from ${{old_price}} to ${{new_price}} ({{percentage}}% reduction). Want to make an offer?',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'market-analysis',
      name: 'Neighborhood Market Analysis',
      description: 'Generate comprehensive market report for a neighborhood',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Research recent sales in area',
          params: {
            query: 'recently sold homes {{neighborhood}} {{city}}',
            limit: 15,
          },
          estimatedCredits: 80,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract comparable sales data',
          params: {
            selectors: {
              sold_price: '.sold-price',
              sold_date: '.sold-date',
              beds: '.beds',
              baths: '.baths',
              sqft: '.sqft',
              address: '.address',
            },
          },
          estimatedCredits: 100,
        },
        {
          order: 3,
          tool: 'ai.analyze',
          description: 'Analyze market trends',
          params: {
            prompt: 'Analyze these recent sales in {{neighborhood}}. Calculate: 1) Average price per sqft, 2) Price trend (up/down/stable), 3) Days on market average, 4) Hot property features. Data: {{sales_data}}',
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'browser.search',
          description: 'Research neighborhood amenities',
          params: {
            query: '{{neighborhood}} schools restaurants parks crime rate walkability',
          },
          estimatedCredits: 60,
        },
        {
          order: 5,
          tool: 'ai.generate',
          description: 'Generate market report',
          params: {
            prompt: 'Create a professional market report for {{neighborhood}} including: Executive Summary, Price Analysis, Market Trends, Neighborhood Highlights, Investment Outlook. Use this data: {{analysis}} {{amenities}}',
          },
          estimatedCredits: 300,
        },
        {
          order: 6,
          tool: 'drive.createDoc',
          description: 'Save market report',
          params: {
            title: 'Market Analysis - {{neighborhood}} - {{date}}',
            content: '{{market_report}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'lead-followup',
      name: 'Automated Lead Follow-up',
      description: 'Send personalized follow-up emails to leads based on their stage',
      trigger: 'scheduled',
      schedule: '0 10 * * 1,3,5', // Mon, Wed, Fri at 10 AM
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch lead list from CRM',
          params: {
            url: '{{crm_api_endpoint}}/leads',
            headers: {
              Authorization: 'Bearer {{api_key}}',
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'data.filter',
          description: 'Filter leads needing follow-up',
          params: {
            conditions: {
              last_contact: 'older_than_3_days',
              status: ['warm', 'hot'],
            },
          },
          estimatedCredits: 10,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Generate personalized email for each lead',
          params: {
            prompt: 'Write a personalized follow-up email for {{lead_name}} who is {{lead_stage}} and interested in {{property_type}} in {{location}}. Reference our last conversation: {{last_notes}}. Keep it friendly and add value.',
          },
          estimatedCredits: 150,
        },
        {
          order: 4,
          tool: 'email.sendBatch',
          description: 'Send follow-up emails',
          params: {
            recipients: '{{lead_emails}}',
            subject_template: 'Following up on your {{property_type}} search',
            body_template: '{{personalized_email}}',
          },
          estimatedCredits: 50,
        },
      ],
    },
  ],

  // Custom instructions template
  customInstructionsTemplate: `Agent Information:
- Agent Name: [Your name]
- Brokerage: [Company name]
- License Number: [License #]
- Specialization: [Residential/Commercial/Luxury]
- Service Area: [Cities/neighborhoods]

Client Preferences:
- Default Search Criteria:
  - Price Range: $[min] - $[max]
  - Bedrooms: [min] - [max]
  - Bathrooms: [min] - [max]
  - Property Type: [Single Family/Condo/Townhouse/etc]
  - Must-Have Features: [List]

Preferred Websites:
- Primary: [Zillow/Realtor.com/Redfin/Local MLS]
- Secondary: [Additional sources]

Communication Preferences:
- Client Email: [Email]
- Follow-up Frequency: [Daily/Every 2 days/Weekly]
- Preferred Contact Time: [Morning/Afternoon/Evening]`,

  // Success metrics
  suggestedKPIs: [
    'New listings found per day',
    'Lead response time',
    'Properties shown per month',
    'Client satisfaction score',
    'Time saved on research',
    'Deals closed with AI assistance',
  ],

  // Default configuration
  defaultConfig: {
    maxSteps: 30,
    maxCreditsPerTask: 600,
    timeoutSeconds: 600,
    retryAttempts: 3,
    requireApproval: false, // Auto-send alerts
  },

  // Tier and visibility
  tier: 'free', // Available to all tiers
  featured: true,
  order: 3,
};
