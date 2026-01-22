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
