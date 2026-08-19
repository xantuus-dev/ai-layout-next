/**
 * Seed Small Business (SMB) Prompt Templates
 *
 * Adds a "Small Business" category and a set of SMB-focused templates to
 * the live PromptTemplate table (the model actually served by
 * /api/templates and rendered on /templates — see seed/route.ts for the
 * pattern this follows).
 *
 * Usage:
 *   npx tsx scripts/seed-smb-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏪 Seeding SMB templates...\n');

  const smbCategory = await prisma.promptTemplateCategory.upsert({
    where: { name: 'Small Business' },
    update: {},
    create: {
      name: 'Small Business',
      description: 'Templates built for small and local business operations',
      icon: '🏪',
      order: 4,
    },
  });

  const templates = [
    {
      title: 'Local Marketing Plan',
      description: 'Draft a marketing plan tailored to a local, budget-constrained business',
      categoryId: smbCategory.id,
      template: `Create a 90-day local marketing plan for {{business_type}} located in {{location}}. Monthly budget is {{monthly_budget}}. Primary goal: {{primary_goal}}. Focus on tactics realistic for a small team (no dedicated marketing staff): local SEO, Google Business Profile, community partnerships, and low-cost paid options. Include a week-by-week action list and how to measure results without expensive tools.`,
      variables: [
        { name: 'business_type', label: 'Business Type', type: 'text', placeholder: 'e.g., neighborhood coffee shop' },
        { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g., Austin, TX' },
        { name: 'monthly_budget', label: 'Monthly Marketing Budget', type: 'text', placeholder: 'e.g., $500' },
        { name: 'primary_goal', label: 'Primary Goal', type: 'select', options: ['more foot traffic', 'online orders', 'repeat customers', 'brand awareness'] },
      ],
      tags: ['smb', 'marketing', 'local'],
      isFeatured: true,
      tier: 'free',
    },
    {
      title: 'Customer Review Response',
      description: 'Draft a professional response to a Google/Yelp review',
      categoryId: smbCategory.id,
      template: `Write a {{tone}} response to this {{platform}} review for a small business:\n\n"{{review_text}}"\n\nThe business is {{business_name}}. If the review is negative, acknowledge the issue, avoid being defensive, and offer a concrete next step (not just an apology). If positive, thank them specifically and reinforce what they praised. Keep it under {{max_length}} words.`,
      variables: [
        { name: 'review_text', label: 'Review Text', type: 'text', placeholder: 'Paste the review here...' },
        { name: 'business_name', label: 'Business Name', type: 'text', placeholder: 'e.g., Fusion Smoothies' },
        { name: 'platform', label: 'Platform', type: 'select', options: ['Google', 'Yelp', 'Facebook', 'TripAdvisor'] },
        { name: 'tone', label: 'Tone', type: 'select', options: ['warm and personal', 'professional', 'apologetic', 'brief'] },
        { name: 'max_length', label: 'Max Length (words)', type: 'number', placeholder: '100' },
      ],
      tags: ['smb', 'reviews', 'customer-service'],
      isFeatured: true,
      tier: 'free',
    },
    {
      title: 'Customer Win-Back Email',
      description: 'Re-engage customers who haven’t purchased in a while',
      categoryId: smbCategory.id,
      template: `Write a win-back email for {{business_name}} targeting customers who haven't purchased in {{inactivity_period}}. Offer: {{offer}}. Tone: {{tone}}. Keep subject line under 50 characters and the body under {{max_words}} words. End with one clear call to action.`,
      variables: [
        { name: 'business_name', label: 'Business Name', type: 'text', placeholder: 'e.g., Fusion Smoothies' },
        { name: 'inactivity_period', label: 'Inactivity Period', type: 'text', placeholder: 'e.g., 60 days' },
        { name: 'offer', label: 'Offer / Incentive', type: 'text', placeholder: 'e.g., 20% off next visit' },
        { name: 'tone', label: 'Tone', type: 'select', options: ['friendly', 'casual', 'urgent', 'appreciative'] },
        { name: 'max_words', label: 'Max Body Length (words)', type: 'number', placeholder: '150' },
      ],
      tags: ['smb', 'email', 'retention'],
      isFeatured: false,
      tier: 'free',
    },
    {
      title: 'Competitor Snapshot',
      description: 'Structure a quick competitive analysis for a local competitor',
      categoryId: smbCategory.id,
      template: `Analyze this competitor for {{business_name}}, a {{business_type}} in {{location}}: {{competitor_name}} ({{competitor_url}}). Cover: pricing (if visible), what they emphasize in their marketing, apparent strengths and weaknesses, and 3 specific things {{business_name}} could do differently to compete. Keep it practical for a business with limited time and budget.`,
      variables: [
        { name: 'business_name', label: 'Your Business Name', type: 'text', placeholder: 'e.g., Fusion Smoothies' },
        { name: 'business_type', label: 'Your Business Type', type: 'text', placeholder: 'e.g., smoothie shop' },
        { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g., Austin, TX' },
        { name: 'competitor_name', label: 'Competitor Name', type: 'text', placeholder: 'e.g., Juice Co.' },
        { name: 'competitor_url', label: 'Competitor Website (optional)', type: 'text', placeholder: 'https://...' },
      ],
      tags: ['smb', 'competitive-analysis', 'strategy'],
      isFeatured: false,
      tier: 'free',
    },
    {
      title: 'Hourly/Local Job Posting',
      description: 'Write a job posting for a local, hourly, or in-person role',
      categoryId: smbCategory.id,
      template: `Write a job posting for a {{role_title}} position at {{business_name}}, a {{business_type}} in {{location}}. Pay: {{pay_range}}. Schedule: {{schedule}}. Key responsibilities: {{responsibilities}}. Write it to appeal to local candidates browsing quickly on a phone — lead with what makes the job appealing, keep requirements minimal and realistic, and include how to apply.`,
      variables: [
        { name: 'role_title', label: 'Role Title', type: 'text', placeholder: 'e.g., Barista' },
        { name: 'business_name', label: 'Business Name', type: 'text', placeholder: 'e.g., Fusion Smoothies' },
        { name: 'business_type', label: 'Business Type', type: 'text', placeholder: 'e.g., smoothie shop' },
        { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g., Austin, TX' },
        { name: 'pay_range', label: 'Pay Range', type: 'text', placeholder: 'e.g., $16-19/hr' },
        { name: 'schedule', label: 'Schedule', type: 'text', placeholder: 'e.g., weekends + 2 weekdays' },
        { name: 'responsibilities', label: 'Key Responsibilities', type: 'text', placeholder: 'e.g., drink prep, register, closing duties' },
      ],
      tags: ['smb', 'hiring', 'hr'],
      isFeatured: false,
      tier: 'free',
    },
    {
      title: 'Pricing Strategy Review',
      description: 'Get a structured second opinion on pricing for a product or service',
      categoryId: smbCategory.id,
      template: `Review the pricing for {{product_or_service}} at {{business_name}}, currently priced at {{current_price}}. Cost to deliver: {{cost}}. Target customer: {{target_customer}}. Local competitors charge roughly {{competitor_price_range}}. Recommend whether to keep, raise, or lower the price, with reasoning, and suggest one pricing experiment that would be low-risk to try.`,
      variables: [
        { name: 'business_name', label: 'Business Name', type: 'text', placeholder: 'e.g., Fusion Smoothies' },
        { name: 'product_or_service', label: 'Product/Service', type: 'text', placeholder: 'e.g., 16oz signature smoothie' },
        { name: 'current_price', label: 'Current Price', type: 'text', placeholder: 'e.g., $7.50' },
        { name: 'cost', label: 'Cost to Deliver', type: 'text', placeholder: 'e.g., $2.75' },
        { name: 'target_customer', label: 'Target Customer', type: 'text', placeholder: 'e.g., health-conscious commuters' },
        { name: 'competitor_price_range', label: 'Competitor Price Range', type: 'text', placeholder: 'e.g., $6-9' },
      ],
      tags: ['smb', 'pricing', 'finance'],
      isFeatured: false,
      tier: 'pro',
    },
  ];

  let created = 0;
  let updated = 0;

  for (const t of templates) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { title: t.title, categoryId: smbCategory.id },
    });

    if (existing) {
      await prisma.promptTemplate.update({
        where: { id: existing.id },
        data: t,
      });
      console.log(`   ↻ Updated: ${t.title}`);
      updated++;
    } else {
      await prisma.promptTemplate.create({ data: t });
      console.log(`   + Created: ${t.title}`);
      created++;
    }
  }

  console.log(`\n✅ Done. Created ${created}, updated ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
