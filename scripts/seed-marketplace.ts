/**
 * Seed Marketplace with Test Skills
 *
 * Run with: npx tsx scripts/seed-marketplace.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_SKILLS = [
  {
    name: 'Email Campaign Automator',
    description: 'Automatically send personalized email campaigns to your contacts. Supports dynamic templates, A/B testing, and detailed analytics tracking.',
    category: 'communication',
    icon: '📧',
    tags: ['email', 'marketing', 'automation', 'campaigns'],
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'email.send',
          description: 'Send personalized email to recipients',
          tool: 'email',
          params: {
            to: '{{input.recipients}}',
            subject: '{{input.subject}}',
            body: '{{input.body}}',
          },
          estimatedCredits: 5,
          estimatedDuration: 3000,
        },
      ],
    },
    parameters: [
      { name: 'recipients', type: 'string', required: true, description: 'Email addresses (comma-separated)' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject line' },
      { name: 'body', type: 'text', required: true, description: 'Email body content' },
    ],
    requiredTools: ['email'],
    requiredIntegrations: ['gmail'],
    estimatedCreditCost: 5,
    featured: true,
    status: 'approved',
  },
  {
    name: 'Price Monitor',
    description: 'Monitor competitor product prices and get alerts when prices change. Perfect for e-commerce businesses tracking market dynamics.',
    category: 'productivity',
    icon: '💰',
    tags: ['monitoring', 'prices', 'scraping', 'alerts'],
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'browser.navigate',
          description: 'Navigate to product page',
          tool: 'browser',
          params: {
            url: '{{input.productUrl}}',
          },
          estimatedCredits: 10,
          estimatedDuration: 5000,
        },
        {
          action: 'browser.extract',
          description: 'Extract price from page',
          tool: 'browser',
          params: {
            selector: '{{input.priceSelector}}',
            attribute: 'text',
          },
          estimatedCredits: 5,
          estimatedDuration: 2000,
        },
      ],
    },
    parameters: [
      { name: 'productUrl', type: 'string', required: true, description: 'URL of product to monitor' },
      { name: 'priceSelector', type: 'string', required: true, description: 'CSS selector for price element' },
    ],
    requiredTools: ['browser'],
    requiredIntegrations: [],
    estimatedCreditCost: 15,
    featured: true,
    status: 'approved',
  },
  {
    name: 'LinkedIn Post Scheduler',
    description: 'Schedule and automatically post content to LinkedIn. Supports images, hashtags, and optimal posting times for maximum engagement.',
    category: 'communication',
    icon: '💼',
    tags: ['linkedin', 'social media', 'scheduling', 'content'],
    pricingModel: 'one-time',
    price: 999, // $9.99
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'http.post',
          description: 'Post to LinkedIn API',
          tool: 'http',
          params: {
            url: 'https://api.linkedin.com/v2/ugcPosts',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer {{input.accessToken}}',
            },
            body: {
              author: '{{input.authorUrn}}',
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: {
                    text: '{{input.content}}',
                  },
                },
              },
            },
          },
          estimatedCredits: 20,
          estimatedDuration: 4000,
        },
      ],
    },
    parameters: [
      { name: 'content', type: 'text', required: true, description: 'Post content' },
      { name: 'accessToken', type: 'string', required: true, description: 'LinkedIn access token' },
      { name: 'authorUrn', type: 'string', required: true, description: 'LinkedIn author URN' },
    ],
    requiredTools: ['http'],
    requiredIntegrations: ['linkedin'],
    estimatedCreditCost: 20,
    featured: false,
    status: 'approved',
  },
  {
    name: 'Data CSV Processor',
    description: 'Process CSV files with custom transformations. Filter rows, merge columns, calculate aggregates, and export cleaned data.',
    category: 'data',
    icon: '📊',
    tags: ['csv', 'data processing', 'analytics', 'export'],
    pricingModel: 'free',
    price: 0,
    skillType: 'javascript',
    skillDefinition: {
      code: `
// Process CSV data
const csv = input.csvData;
const rows = csv.split('\\n').map(row => row.split(','));
const headers = rows[0];

// Filter and transform
const filtered = rows.slice(1).filter(row => {
  // Add custom filtering logic
  return row.length === headers.length;
});

// Return processed data
return {
  headers,
  rowCount: filtered.length,
  data: filtered,
};
      `.trim(),
    },
    parameters: [
      { name: 'csvData', type: 'text', required: true, description: 'CSV data to process' },
    ],
    requiredTools: [],
    requiredIntegrations: [],
    estimatedCreditCost: 10,
    featured: false,
    status: 'approved',
  },
  {
    name: 'Slack Daily Standup Bot',
    description: 'Automatically post daily standup reminders to Slack channels and collect team updates. Includes summary reports.',
    category: 'communication',
    icon: '💬',
    tags: ['slack', 'standup', 'team', 'productivity'],
    pricingModel: 'subscription',
    price: 499, // $4.99/month
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'http.post',
          description: 'Post standup reminder to Slack',
          tool: 'http',
          params: {
            url: 'https://slack.com/api/chat.postMessage',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer {{input.slackToken}}',
              'Content-Type': 'application/json',
            },
            body: {
              channel: '{{input.channelId}}',
              text: '🌅 Good morning team! Time for daily standup updates:\n\n1️⃣ What did you do yesterday?\n2️⃣ What will you do today?\n3️⃣ Any blockers?',
            },
          },
          estimatedCredits: 15,
          estimatedDuration: 3000,
        },
      ],
    },
    parameters: [
      { name: 'slackToken', type: 'string', required: true, description: 'Slack bot token' },
      { name: 'channelId', type: 'string', required: true, description: 'Slack channel ID' },
    ],
    requiredTools: ['http'],
    requiredIntegrations: ['slack'],
    estimatedCreditCost: 15,
    featured: true,
    status: 'approved',
  },
  {
    name: 'Content Summarizer',
    description: 'Automatically summarize long articles, blog posts, or documents. Generate key points, TL;DR, and executive summaries.',
    category: 'productivity',
    icon: '📝',
    tags: ['ai', 'summarization', 'content', 'reading'],
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'ai.complete',
          description: 'Generate summary using AI',
          tool: 'ai',
          params: {
            prompt: 'Summarize the following text in 3-5 bullet points:\n\n{{input.content}}',
            model: 'gpt-4o-mini',
            maxTokens: 500,
          },
          estimatedCredits: 30,
          estimatedDuration: 8000,
        },
      ],
    },
    parameters: [
      { name: 'content', type: 'text', required: true, description: 'Content to summarize' },
    ],
    requiredTools: ['ai'],
    requiredIntegrations: [],
    estimatedCreditCost: 30,
    featured: true,
    status: 'approved',
  },
  {
    name: 'Website Uptime Monitor',
    description: 'Monitor your website uptime with regular health checks. Get instant alerts when your site goes down.',
    category: 'productivity',
    icon: '🔍',
    tags: ['monitoring', 'uptime', 'alerts', 'devops'],
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'http.get',
          description: 'Check website status',
          tool: 'http',
          params: {
            url: '{{input.websiteUrl}}',
            timeout: 10000,
          },
          estimatedCredits: 5,
          estimatedDuration: 3000,
        },
      ],
    },
    parameters: [
      { name: 'websiteUrl', type: 'string', required: true, description: 'Website URL to monitor' },
    ],
    requiredTools: ['http'],
    requiredIntegrations: [],
    estimatedCreditCost: 5,
    featured: false,
    status: 'approved',
  },
  {
    name: 'Google Drive Backup',
    description: 'Automatically backup important files to Google Drive. Supports scheduled backups and version history.',
    category: 'integration',
    icon: '☁️',
    tags: ['google drive', 'backup', 'storage', 'automation'],
    pricingModel: 'free',
    price: 0,
    skillType: 'config',
    skillDefinition: {
      steps: [
        {
          action: 'drive.upload',
          description: 'Upload file to Google Drive',
          tool: 'drive',
          params: {
            fileName: '{{input.fileName}}',
            fileContent: '{{input.fileContent}}',
            folderId: '{{input.folderId}}',
          },
          estimatedCredits: 10,
          estimatedDuration: 5000,
        },
      ],
    },
    parameters: [
      { name: 'fileName', type: 'string', required: true, description: 'Name of file to backup' },
      { name: 'fileContent', type: 'text', required: true, description: 'File content' },
      { name: 'folderId', type: 'string', required: false, description: 'Google Drive folder ID' },
    ],
    requiredTools: ['drive'],
    requiredIntegrations: ['google'],
    estimatedCreditCost: 10,
    featured: false,
    status: 'approved',
  },
];

async function seedMarketplace() {
  console.log('🌱 Seeding marketplace with test skills...\n');

  try {
    // Get or create a test user to be the creator
    let creator = await prisma.user.findFirst({
      where: { email: { not: null } },
    });

    if (!creator) {
      console.log('⚠️  No users found. Creating test user...');
      creator = await prisma.user.create({
        data: {
          email: 'marketplace-admin@xantuus.com',
          name: 'Marketplace Admin',
        },
      });
      console.log(`✅ Created test user: ${creator.email}\n`);
    } else {
      console.log(`✅ Using existing user: ${creator.email}\n`);
    }

    // Create skills
    let created = 0;
    let skipped = 0;

    for (const skillData of TEST_SKILLS) {
      const existing = await prisma.customSkill.findFirst({
        where: {
          name: skillData.name,
          creatorId: creator.id,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${skillData.name} (already exists)`);
        skipped++;
        continue;
      }

      await prisma.customSkill.create({
        data: {
          ...skillData,
          creatorId: creator.id,
          skillDefinition: skillData.skillDefinition as any,
          parameters: skillData.parameters as any,
        },
      });

      console.log(`✅ Created: ${skillData.icon} ${skillData.name}`);
      created++;
    }

    console.log(`\n🎉 Marketplace seeding complete!`);
    console.log(`   Created: ${created} skills`);
    console.log(`   Skipped: ${skipped} skills (already exist)`);
    console.log(`   Total: ${created + skipped} skills in marketplace\n`);
  } catch (error) {
    console.error('❌ Error seeding marketplace:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedMarketplace();
