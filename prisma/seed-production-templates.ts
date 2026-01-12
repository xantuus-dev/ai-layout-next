import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = {
  categories: [
    { name: 'Email & Communication', description: 'Templates for emails, messages, and professional communication', icon: '✉️', order: 1 },
    { name: 'Content Creation', description: 'Templates for blogs, articles, and marketing content', icon: '📝', order: 2 },
    { name: 'Professional Documents', description: 'Templates for resumes, cover letters, and business documents', icon: '💼', order: 3 },
    { name: 'Development', description: 'Templates for coding, documentation, and technical content', icon: '💻', order: 4 },
    { name: 'Data & Analytics', description: 'Templates for data processing, analysis, and reporting', icon: '📊', order: 5 },
    { name: 'Productivity', description: 'Templates for task management, planning, and organization', icon: '⚡', order: 6 },
  ],

  free: [
    {
      id: 'free-email-basic',
      title: 'Basic Email Composer',
      description: 'Compose professional emails quickly with guided prompts',
      category: 'Email & Communication',
      template: `Write a {{tone}} email about the following:\n\nSubject: {{subject}}\n\nMain Message:\n{{message}}\n\nKey Points to Include:\n{{key_points}}\n\nClosing: {{closing_type}}`,
      tags: ['email', 'communication', 'basic'],
      featured: false,
      variables: [
        { name: 'tone', label: 'Tone', type: 'select', options: ['professional', 'friendly', 'formal', 'casual', 'persuasive'], required: true },
        { name: 'subject', label: 'Email Subject', type: 'text', placeholder: 'Meeting follow-up', required: true },
        { name: 'message', label: 'Main Message', type: 'textarea', placeholder: 'What do you want to say?', required: true },
        { name: 'key_points', label: 'Key Points', type: 'textarea', placeholder: 'Bullet points to include', required: false },
        { name: 'closing_type', label: 'Closing', type: 'select', options: ['Best regards', 'Sincerely', 'Thank you', 'Looking forward'], required: true },
      ],
    },
    {
      id: 'free-blog-post',
      title: 'Blog Post Writer',
      description: 'Create engaging blog posts with structured content',
      category: 'Content Creation',
      template: `Write a {{word_count}}-word blog post about:\n\nTopic: {{topic}}\nTarget Audience: {{audience}}\nTone: {{tone}}\n\nKey Points to Cover:\n{{key_points}}\n\nSEO Keywords: {{keywords}}\n\nInclude:\n- Compelling introduction\n- Clear section headers\n- Actionable conclusion\n- Natural keyword integration`,
      tags: ['blog', 'content', 'writing', 'seo'],
      featured: true,
      variables: [
        { name: 'topic', label: 'Blog Topic', type: 'text', placeholder: 'AI in Healthcare', required: true },
        { name: 'word_count', label: 'Target Word Count', type: 'number', placeholder: '800', required: true },
        { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'Healthcare professionals', required: true },
        { name: 'tone', label: 'Writing Tone', type: 'select', options: ['informative', 'conversational', 'professional', 'casual'], required: true },
        { name: 'key_points', label: 'Key Points', type: 'textarea', placeholder: 'Main topics to discuss', required: true },
        { name: 'keywords', label: 'SEO Keywords', type: 'text', placeholder: 'AI, healthcare, technology', required: false },
      ],
    },
    {
      id: 'free-resume-builder',
      title: 'Resume Builder',
      description: 'Create a professional resume tailored to your target role',
      category: 'Professional Documents',
      template: `Create a professional resume for:\n\nTarget Position: {{job_title}}\nIndustry: {{industry}}\nExperience Level: {{experience_level}}\n\nProfessional Summary:\n{{summary}}\n\nWork Experience:\n{{work_experience}}\n\nEducation:\n{{education}}\n\nKey Skills:\n{{skills}}\n\nFormat with:\n- Clear section headers\n- Bullet points for achievements\n- Action verbs\n- Quantifiable results\n- ATS-friendly formatting`,
      tags: ['resume', 'career', 'job search'],
      featured: true,
      variables: [
        { name: 'job_title', label: 'Target Job Title', type: 'text', placeholder: 'Senior Software Engineer', required: true },
        { name: 'industry', label: 'Industry', type: 'text', placeholder: 'Technology', required: true },
        { name: 'experience_level', label: 'Experience Level', type: 'select', options: ['entry-level', 'mid-level', 'senior', 'executive'], required: true },
        { name: 'summary', label: 'Professional Summary', type: 'textarea', placeholder: 'Brief overview of your experience', required: true },
        { name: 'work_experience', label: 'Work Experience', type: 'textarea', placeholder: 'List your relevant work history', required: true },
        { name: 'education', label: 'Education', type: 'textarea', placeholder: 'Your educational background', required: true },
        { name: 'skills', label: 'Key Skills', type: 'text', placeholder: 'Python, React, AWS, etc.', required: true },
      ],
    },
    {
      id: 'free-social-media',
      title: 'Social Media Post Generator',
      description: 'Create engaging social media posts for any platform',
      category: 'Content Creation',
      template: `Create a {{platform}} post about:\n\nTopic: {{topic}}\nTone: {{tone}}\nLength: {{length}}\n\nInclude:\n{{content_requirements}}\n\nCall-to-Action: {{cta}}\n\n{{hashtags_required}}`,
      tags: ['social media', 'marketing', 'content'],
      featured: false,
      variables: [
        { name: 'platform', label: 'Platform', type: 'select', options: ['Twitter/X', 'LinkedIn', 'Facebook', 'Instagram'], required: true },
        { name: 'topic', label: 'Post Topic', type: 'text', placeholder: 'Product launch', required: true },
        { name: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'enthusiastic', 'informative'], required: true },
        { name: 'length', label: 'Post Length', type: 'select', options: ['short (1-2 sentences)', 'medium (3-5 sentences)', 'long (paragraph)'], required: true },
        { name: 'content_requirements', label: 'What to Include', type: 'textarea', placeholder: 'Key messages, features, benefits', required: true },
        { name: 'cta', label: 'Call-to-Action', type: 'text', placeholder: 'Learn more, Sign up, etc.', required: false },
        { name: 'hashtags_required', label: 'Include Hashtags?', type: 'select', options: ['Yes, include relevant hashtags', 'No hashtags needed'], required: false },
      ],
    },
    {
      id: 'free-task-list',
      title: 'Task List Creator',
      description: 'Break down projects into actionable tasks',
      category: 'Productivity',
      template: `Create a detailed task list for:\n\nProject: {{project_name}}\nTimeline: {{timeline}}\nPriority: {{priority}}\n\nProject Goals:\n{{goals}}\n\nKey Deliverables:\n{{deliverables}}\n\nBreak this down into:\n- Specific, actionable tasks\n- Estimated time for each task\n- Task dependencies\n- Priority levels (High/Medium/Low)\n- Clear success criteria`,
      tags: ['productivity', 'planning', 'tasks'],
      featured: false,
      variables: [
        { name: 'project_name', label: 'Project Name', type: 'text', placeholder: 'Website Redesign', required: true },
        { name: 'timeline', label: 'Timeline', type: 'text', placeholder: '2 weeks', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], required: true },
        { name: 'goals', label: 'Project Goals', type: 'textarea', placeholder: 'What needs to be achieved?', required: true },
        { name: 'deliverables', label: 'Key Deliverables', type: 'textarea', placeholder: 'What will be delivered?', required: true },
      ],
    },
  ],

  pro: [
    {
      id: 'pro-email-professional',
      title: 'Professional Email Composer',
      description: 'Draft professional emails with research and Gmail integration',
      category: 'Email & Communication',
      template: `Draft a professional email:\n\n**Recipient**: {{recipient_name}}\n**Subject**: {{email_subject}}\n**Tone**: {{tone_style}}\n**Length**: {{desired_length}} words\n**Purpose**: {{email_purpose}}\n\nInstructions:\n- Maintain {{tone_style}} tone\n- Keep length to ~{{desired_length}} words\n- Include clear call-to-action\n- Prepare for Gmail sending\n\n{{additional_instructions}}`,
      tags: ['email', 'professional', 'gmail', 'automation'],
      featured: true,
      requiresGmail: true,
      variables: [
        { name: 'recipient_name', label: 'Recipient Name', type: 'text', placeholder: 'John Smith', required: true },
        { name: 'email_subject', label: 'Email Subject', type: 'text', placeholder: 'Follow-up on project', required: true },
        { name: 'tone_style', label: 'Tone', type: 'select', options: ['professional', 'friendly', 'formal', 'casual', 'persuasive'], required: true },
        { name: 'desired_length', label: 'Length (words)', type: 'number', placeholder: '300', required: true },
        { name: 'email_purpose', label: 'Purpose', type: 'textarea', placeholder: 'Follow up on project meeting', required: true },
        { name: 'additional_instructions', label: 'Additional Instructions', type: 'textarea', placeholder: 'Any specific requirements', required: false },
      ],
    },
    {
      id: 'pro-content-localizer',
      title: 'Content Localizer',
      description: 'Adapt content for new markets with cultural localization',
      category: 'Content Creation',
      template: `Localize content for {{target_market}}:\n\n**Original Content**:\n{{original_content}}\n\n**Target Market**: {{target_market}}\n**Target Language**: {{target_language}}\n**Content Type**: {{content_type}}\n\nProvide:\n1. Fully localized version\n2. Cultural adaptation notes\n3. Visual adaptation suggestions\n4. Potential concerns`,
      tags: ['localization', 'translation', 'cultural', 'marketing'],
      featured: true,
      variables: [
        { name: 'target_market', label: 'Target Market', type: 'text', placeholder: 'Japanese market', required: true },
        { name: 'target_language', label: 'Target Language', type: 'text', placeholder: 'Japanese', required: true },
        { name: 'content_type', label: 'Content Type', type: 'select', options: ['marketing copy', 'website content', 'email campaign', 'social media', 'documentation'], required: true },
        { name: 'original_content', label: 'Original Content', type: 'textarea', placeholder: 'Paste content here', required: true },
      ],
    },
    {
      id: 'pro-data-cleaner',
      title: 'Advanced Data Cleaner',
      description: 'Clean and structure raw data with transformations',
      category: 'Data & Analytics',
      template: `Clean and format data:\n\n**Raw Data**:\n{{raw_data}}\n\n**Output Format**: {{output_format}}\n**Data Type**: {{data_type}}\n**Sort By**: {{sort_criteria}}\n\nCleaning:\n- Remove duplicates\n- Standardize formatting\n- Fill missing values\n- Validate integrity\n- Export in {{output_format}}`,
      tags: ['data', 'cleaning', 'formatting', 'export'],
      featured: true,
      requiresGoogleDrive: true,
      variables: [
        { name: 'raw_data', label: 'Raw Data', type: 'textarea', placeholder: 'Paste data here', required: true },
        { name: 'output_format', label: 'Output Format', type: 'select', options: ['CSV', 'Excel', 'JSON', 'SQL', 'Markdown table'], required: true },
        { name: 'data_type', label: 'Data Type', type: 'select', options: ['contact list', 'sales data', 'survey results', 'product inventory', 'financial records'], required: true },
        { name: 'sort_criteria', label: 'Sort By', type: 'text', placeholder: 'date, name, amount', required: true },
      ],
    },
  ],

  enterprise: [
    {
      id: 'ent-meeting-reminder',
      title: 'Automated Meeting Reminder System',
      description: 'Set up automated reminders from Google Calendar',
      category: 'Productivity',
      template: `Set up automated meeting reminders:\n\n**Event Type**: {{event_type}}\n**Reminder Timing**: {{reminder_timing}}\n**Notification Method**: {{notification_method}}\n\nInclude:\n- Meeting details\n- Attendees list\n- Meeting link\n- Pre-meeting actions\n\nRules:\n- Organizer only: {{organizer_only}}\n- Include prep: {{include_prep}}`,
      tags: ['calendar', 'automation', 'reminders', 'meetings'],
      featured: true,
      requiresCalendar: true,
      requiresGmail: true,
      variables: [
        { name: 'event_type', label: 'Event Type', type: 'select', options: ['all events', 'meetings only', 'specific calendar'], required: true },
        { name: 'reminder_timing', label: 'Reminder Timing', type: 'select', options: ['1 hour before', '2 hours before', '1 day before', '1 week before'], required: true },
        { name: 'notification_method', label: 'Notification Method', type: 'select', options: ['email', 'SMS', 'both'], required: true },
        { name: 'organizer_only', label: 'Organizer Only', type: 'select', options: ['yes', 'no'], required: true },
        { name: 'include_prep', label: 'Include Prep', type: 'select', options: ['yes', 'no'], required: true },
      ],
    },
    {
      id: 'ent-batch-processor',
      title: 'Batch File Processor',
      description: 'Process multiple files from Drive with automation',
      category: 'Data & Analytics',
      template: `Set up batch file processing:\n\n**Source**: {{source_folder}}\n**File Types**: {{file_types}}\n**Action**: {{action_type}}\n**Output**: {{output_format}}\n\nProcess:\n1. File selection\n2. Processing workflow\n3. Error handling\n4. Output organization\n5. Status reporting`,
      tags: ['batch', 'automation', 'files', 'drive'],
      featured: true,
      requiresGoogleDrive: true,
      variables: [
        { name: 'source_folder', label: 'Source Folder', type: 'text', placeholder: 'Drive folder path', required: true },
        { name: 'file_types', label: 'File Types', type: 'text', placeholder: 'PDF, DOCX, Images', required: true },
        { name: 'action_type', label: 'Action', type: 'select', options: ['convert format', 'extract data', 'rename', 'organize'], required: true },
        { name: 'output_format', label: 'Output Format', type: 'text', placeholder: 'Desired format', required: true },
      ],
    },
  ],
};

async function main() {
  console.log('🌱 Starting production template seeding...\n');

  // Create categories
  console.log('Creating categories...');
  const categoryMap = new Map();

  for (const cat of templates.categories) {
    const category = await prisma.promptTemplateCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap.set(cat.name, category);
    console.log(`  ✓ ${cat.icon} ${cat.name}`);
  }

  console.log('\n Creating Free tier templates (12)...');
  for (const tpl of templates.free) {
    await prisma.promptTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        template: tpl.template,
        categoryId: categoryMap.get(tpl.category)?.id,
        tags: tpl.tags,
        variables: tpl.variables,
        tier: 'free',
        isPublic: true,
        isActive: true,
        isFeatured: tpl.featured,
        requiresGoogleDrive: false,
        requiresGmail: false,
        requiresCalendar: false,
      },
    });
    console.log(`  ✓ ${tpl.title}`);
  }

  console.log('\n Creating Pro tier templates (10)...');
  for (const tpl of templates.pro) {
    await prisma.promptTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        template: tpl.template,
        categoryId: categoryMap.get(tpl.category)?.id,
        tags: tpl.tags,
        variables: tpl.variables,
        tier: 'pro',
        isPublic: true,
        isActive: true,
        isFeatured: tpl.featured,
        requiresGoogleDrive: tpl.requiresGoogleDrive || false,
        requiresGmail: tpl.requiresGmail || false,
        requiresCalendar: false,
      },
    });
    console.log(`  ✓ ${tpl.title}`);
  }

  console.log('\nCreating Enterprise tier templates (6)...');
  for (const tpl of templates.enterprise) {
    await prisma.promptTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        template: tpl.template,
        categoryId: categoryMap.get(tpl.category)?.id,
        tags: tpl.tags,
        variables: tpl.variables,
        tier: 'enterprise',
        isPublic: true,
        isActive: true,
        isFeatured: tpl.featured,
        requiresGoogleDrive: tpl.requiresGoogleDrive || false,
        requiresGmail: tpl.requiresGmail || false,
        requiresCalendar: tpl.requiresCalendar || false,
      },
    });
    console.log(`  ✓ ${tpl.title}`);
  }

  console.log('\n✅ Production template seeding completed!');
  console.log('\n📊 Summary:');
  console.log(`  - 6 categories created`);
  console.log(`  - 5 Free tier templates`);
  console.log(`  - 3 Pro tier templates`);
  console.log(`  - 2 Enterprise tier templates`);
  console.log(`  - Total: 10 templates\n`);
  console.log('Note: This is Phase 3 initial seed. Full 28 templates available in complete seed file.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
