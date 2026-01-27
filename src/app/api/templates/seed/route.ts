import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Create default categories first
    const writingCategory = await prisma.promptTemplateCategory.upsert({
      where: { name: 'Writing' },
      update: {},
      create: {
        name: 'Writing',
        description: 'Templates for writing and content creation',
        icon: '✍️',
        order: 1,
      },
    });

    const codingCategory = await prisma.promptTemplateCategory.upsert({
      where: { name: 'Coding' },
      update: {},
      create: {
        name: 'Coding',
        description: 'Templates for code and technical tasks',
        icon: '💻',
        order: 2,
      },
    });

    const businessCategory = await prisma.promptTemplateCategory.upsert({
      where: { name: 'Business' },
      update: {},
      create: {
        name: 'Business',
        description: 'Templates for business and productivity',
        icon: '💼',
        order: 3,
      },
    });

    // Create example templates
    const templates = [
      {
        title: 'Rename Files with Custom Convention',
        description: 'Rename all files in a folder based on a custom naming convention',
        categoryId: codingCategory.id,
        template: `Rename all files in the specified folder based on the following naming convention: {{new_filename_structure}}. If the convention includes a sequence, please start numbering from {{starting_number}}. This will help with file organization.`,
        variables: [
          {
            name: 'new_filename_structure',
            label: 'New Filename Structure',
            type: 'text',
            placeholder: 'e.g., project_YYYY-MM-DD_###',
          },
          {
            name: 'starting_number',
            label: 'Starting Number',
            type: 'number',
            placeholder: '1',
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Email Response Generator',
        description: 'Generate professional email responses',
        categoryId: businessCategory.id,
        template: `Draft a professional email response to {{email_topic}}. The tone should be {{email_tone}} and the length should be approximately {{email_length}} words. Please include a {{greeting_style}} greeting and a professional closing.`,
        variables: [
          {
            name: 'email_topic',
            label: 'Email Topic',
            type: 'text',
            placeholder: 'e.g., customer complaint about delayed delivery',
          },
          {
            name: 'email_tone',
            label: 'Tone',
            type: 'select',
            options: ['formal', 'casual', 'friendly', 'apologetic', 'urgent'],
          },
          {
            name: 'email_length',
            label: 'Length (words)',
            type: 'number',
            placeholder: '200',
          },
          {
            name: 'greeting_style',
            label: 'Greeting Style',
            type: 'select',
            options: ['formal', 'casual', 'warm'],
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Code Refactoring Assistant',
        description: 'Get suggestions for refactoring your code',
        categoryId: codingCategory.id,
        template: `Please review and refactor the following {{code_language}} code. Focus on improving {{focus_area}}. The code is:\n\n{{code_snippet}}\n\nProvide specific suggestions and explain the benefits of each change.`,
        variables: [
          {
            name: 'code_language',
            label: 'Programming Language',
            type: 'text',
            placeholder: 'e.g., Python, JavaScript, Java',
          },
          {
            name: 'focus_area',
            label: 'Focus Area',
            type: 'select',
            options: ['performance', 'readability', 'best practices', 'security', 'maintainability'],
          },
          {
            name: 'code_snippet',
            label: 'Code Snippet',
            type: 'text',
            placeholder: 'Paste your code here...',
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Content Summarizer',
        description: 'Summarize long content into key points',
        categoryId: writingCategory.id,
        template: `Please summarize the following content into {{summary_length}} key points. The summary should be {{summary_style}} and suitable for {{target_audience}}.\n\nContent: {{content_to_summarize}}`,
        variables: [
          {
            name: 'content_to_summarize',
            label: 'Content to Summarize',
            type: 'text',
            placeholder: 'Paste the content here...',
          },
          {
            name: 'summary_length',
            label: 'Number of Key Points',
            type: 'number',
            placeholder: '5',
          },
          {
            name: 'summary_style',
            label: 'Summary Style',
            type: 'select',
            options: ['bullet points', 'paragraph', 'executive summary'],
          },
          {
            name: 'target_audience',
            label: 'Target Audience',
            type: 'select',
            options: ['general', 'technical', 'executive', 'students'],
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Social Media Post Creator',
        description: 'Create engaging social media posts',
        categoryId: businessCategory.id,
        template: `Create a {{platform}} post about {{post_topic}}. The post should be {{post_tone}} with a target length of {{post_length}} characters. Include {{hashtag_count}} relevant hashtags.`,
        variables: [
          {
            name: 'platform',
            label: 'Social Media Platform',
            type: 'select',
            options: ['Twitter/X', 'LinkedIn', 'Facebook', 'Instagram'],
          },
          {
            name: 'post_topic',
            label: 'Post Topic',
            type: 'text',
            placeholder: 'e.g., new product launch',
          },
          {
            name: 'post_tone',
            label: 'Tone',
            type: 'select',
            options: ['professional', 'casual', 'enthusiastic', 'informative', 'humorous'],
          },
          {
            name: 'post_length',
            label: 'Target Length (characters)',
            type: 'number',
            placeholder: '280',
          },
          {
            name: 'hashtag_count',
            label: 'Number of Hashtags',
            type: 'number',
            placeholder: '3',
          },
        ],
        isFeatured: true,
        tier: 'pro',
      },
      {
        title: 'Meeting Notes Formatter',
        description: 'Structure and format meeting notes',
        categoryId: businessCategory.id,
        template: `Format the following meeting notes into a structured document. Include sections for: attendees, key discussion points, decisions made, and action items with owners.\n\nMeeting about: {{meeting_topic}}\nDate: {{meeting_date}}\n\nRaw notes:\n{{raw_notes}}`,
        variables: [
          {
            name: 'meeting_topic',
            label: 'Meeting Topic',
            type: 'text',
            placeholder: 'e.g., Q1 Planning Review',
          },
          {
            name: 'meeting_date',
            label: 'Meeting Date',
            type: 'text',
            placeholder: 'e.g., January 22, 2026',
          },
          {
            name: 'raw_notes',
            label: 'Raw Meeting Notes',
            type: 'text',
            placeholder: 'Paste your notes here...',
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Marketing Campaign Creator',
        description: 'Create a complete marketing campaign with email, social, and ad copy',
        categoryId: businessCategory.id,
        template: `Create a comprehensive marketing campaign for {{product_name}} targeting {{target_audience}}. Include:\n1. Email subject lines (5 variations)\n2. Social media posts (3 for each platform: Twitter, LinkedIn, Facebook)\n3. Ad copy for Google Ads (headline and description)\n4. Key messaging points\n\nBudget: {{budget}}\nCampaign goal: {{campaign_goal}}`,
        variables: [
          {
            name: 'product_name',
            label: 'Product/Service Name',
            type: 'text',
            placeholder: 'e.g., AI Layout Builder',
          },
          {
            name: 'target_audience',
            label: 'Target Audience',
            type: 'text',
            placeholder: 'e.g., small business owners, 25-45 years old',
          },
          {
            name: 'budget',
            label: 'Campaign Budget',
            type: 'text',
            placeholder: 'e.g., $5,000',
          },
          {
            name: 'campaign_goal',
            label: 'Campaign Goal',
            type: 'select',
            options: ['brand awareness', 'lead generation', 'sales conversion', 'customer retention'],
          },
        ],
        isFeatured: true,
        tier: 'pro',
      },
      {
        title: 'Business Plan Generator',
        description: 'Generate a comprehensive business plan outline',
        categoryId: businessCategory.id,
        template: `Create a comprehensive business plan for {{business_name}}, a {{business_type}} in the {{industry}} industry. Include:\n1. Executive Summary\n2. Company Description\n3. Market Analysis\n4. Organization & Management\n5. Products/Services\n6. Marketing Strategy\n7. Financial Projections\n\nTarget market: {{target_market}}\nFunding needed: {{funding_amount}}`,
        variables: [
          {
            name: 'business_name',
            label: 'Business Name',
            type: 'text',
            placeholder: 'e.g., Xantuus AI',
          },
          {
            name: 'business_type',
            label: 'Business Type',
            type: 'select',
            options: ['startup', 'small business', 'enterprise', 'non-profit'],
          },
          {
            name: 'industry',
            label: 'Industry',
            type: 'text',
            placeholder: 'e.g., SaaS, E-commerce, Consulting',
          },
          {
            name: 'target_market',
            label: 'Target Market',
            type: 'text',
            placeholder: 'e.g., SMB owners in North America',
          },
          {
            name: 'funding_amount',
            label: 'Funding Needed',
            type: 'text',
            placeholder: 'e.g., $500,000',
          },
        ],
        isFeatured: true,
        tier: 'pro',
      },
      {
        title: 'Job Description Writer',
        description: 'Create professional job descriptions',
        categoryId: businessCategory.id,
        template: `Write a professional job description for a {{job_title}} position. Include:\n1. Job Summary\n2. Key Responsibilities (5-7 bullet points)\n3. Required Qualifications\n4. Preferred Qualifications\n5. Benefits & Perks\n\nCompany: {{company_name}}\nLocation: {{job_location}}\nExperience level: {{experience_level}}\nSalary range: {{salary_range}}`,
        variables: [
          {
            name: 'job_title',
            label: 'Job Title',
            type: 'text',
            placeholder: 'e.g., Senior Marketing Manager',
          },
          {
            name: 'company_name',
            label: 'Company Name',
            type: 'text',
            placeholder: 'e.g., Xantuus AI',
          },
          {
            name: 'job_location',
            label: 'Job Location',
            type: 'text',
            placeholder: 'e.g., Remote, San Francisco, Hybrid',
          },
          {
            name: 'experience_level',
            label: 'Experience Level',
            type: 'select',
            options: ['entry-level', 'mid-level', 'senior', 'executive'],
          },
          {
            name: 'salary_range',
            label: 'Salary Range',
            type: 'text',
            placeholder: 'e.g., $80,000-$120,000',
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Customer Service Scripts',
        description: 'Generate customer service response scripts for common scenarios',
        categoryId: businessCategory.id,
        template: `Create customer service response scripts for {{scenario_type}}. Include:\n1. Opening greeting\n2. Empathy statement\n3. Solution/Next steps\n4. Closing\n\nCompany: {{company_name}}\nTone: {{tone_preference}}\nInclude: {{include_elements}}`,
        variables: [
          {
            name: 'scenario_type',
            label: 'Scenario Type',
            type: 'select',
            options: ['product complaint', 'billing inquiry', 'technical support', 'refund request', 'general inquiry'],
          },
          {
            name: 'company_name',
            label: 'Company Name',
            type: 'text',
            placeholder: 'e.g., Xantuus AI',
          },
          {
            name: 'tone_preference',
            label: 'Tone',
            type: 'select',
            options: ['professional', 'friendly', 'empathetic', 'concise'],
          },
          {
            name: 'include_elements',
            label: 'Include Elements',
            type: 'text',
            placeholder: 'e.g., apology, compensation offer, escalation path',
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
      {
        title: 'Competitor Analysis',
        description: 'Analyze competitors and create strategic insights',
        categoryId: businessCategory.id,
        template: `Conduct a competitor analysis for {{your_company}} in the {{industry}} industry. Analyze {{competitor_name}} and provide:\n1. Strengths & Weaknesses\n2. Product/Service Comparison\n3. Pricing Strategy\n4. Marketing Approach\n5. Differentiation Opportunities\n\nFocus areas: {{focus_areas}}`,
        variables: [
          {
            name: 'your_company',
            label: 'Your Company Name',
            type: 'text',
            placeholder: 'e.g., Xantuus AI',
          },
          {
            name: 'competitor_name',
            label: 'Competitor Name',
            type: 'text',
            placeholder: 'e.g., ChatGPT, Claude',
          },
          {
            name: 'industry',
            label: 'Industry',
            type: 'text',
            placeholder: 'e.g., AI SaaS',
          },
          {
            name: 'focus_areas',
            label: 'Focus Areas',
            type: 'text',
            placeholder: 'e.g., pricing, features, customer service',
          },
        ],
        isFeatured: true,
        tier: 'pro',
      },
      {
        title: 'Product Description Writer',
        description: 'Create compelling product descriptions for e-commerce',
        categoryId: businessCategory.id,
        template: `Write a compelling product description for {{product_name}}. Include:\n1. Attention-grabbing headline\n2. Key features (5-7 bullet points)\n3. Benefits & use cases\n4. Call-to-action\n\nProduct category: {{product_category}}\nTarget customer: {{target_customer}}\nPrice point: {{price_point}}\nTone: {{tone_style}}`,
        variables: [
          {
            name: 'product_name',
            label: 'Product Name',
            type: 'text',
            placeholder: 'e.g., Wireless Noise-Canceling Headphones',
          },
          {
            name: 'product_category',
            label: 'Product Category',
            type: 'text',
            placeholder: 'e.g., Electronics, Fashion, Home & Garden',
          },
          {
            name: 'target_customer',
            label: 'Target Customer',
            type: 'text',
            placeholder: 'e.g., professionals, students, fitness enthusiasts',
          },
          {
            name: 'price_point',
            label: 'Price Point',
            type: 'select',
            options: ['budget', 'mid-range', 'premium', 'luxury'],
          },
          {
            name: 'tone_style',
            label: 'Tone Style',
            type: 'select',
            options: ['professional', 'casual', 'enthusiastic', 'luxury', 'technical'],
          },
        ],
        isFeatured: true,
        tier: 'free',
      },
    ];

    // Create templates
    const createdTemplates = [];
    for (const templateData of templates) {
      const template = await prisma.promptTemplate.upsert({
        where: {
          // Use a unique identifier - since there's no unique constraint, we'll check by title
          id: `seed-${templateData.title.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: templateData,
        create: {
          id: `seed-${templateData.title.toLowerCase().replace(/\s+/g, '-')}`,
          ...templateData,
        },
      });
      createdTemplates.push(template);
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdTemplates.length} templates`,
      templates: createdTemplates,
    });
  } catch (error) {
    console.error('Error seeding templates:', error);
    return NextResponse.json(
      { error: 'Failed to seed templates', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check if templates exist
export async function GET() {
  try {
    const count = await prisma.promptTemplate.count({
      where: { isFeatured: true },
    });

    return NextResponse.json({
      featuredCount: count,
      needsSeeding: count === 0,
    });
  } catch (error) {
    console.error('Error checking templates:', error);
    return NextResponse.json(
      { error: 'Failed to check templates' },
      { status: 500 }
    );
  }
}
