/**
 * Recruiter Assistant Template
 *
 * AI agent for recruiting professionals to automate resume screening,
 * candidate sourcing, outreach, interview scheduling, and pipeline management.
 */

import { VerticalTemplate } from './types';

export const recruiterAssistantTemplate: VerticalTemplate = {
  // Identity
  name: 'Recruiter Assistant',
  description: 'Streamline your recruiting process with AI-powered resume screening, candidate sourcing, automated outreach, and interview coordination. Perfect for in-house recruiters and staffing agencies.',
  industry: 'recruiting',
  icon: '👔',
  color: '#3B82F6', // Blue

  // Agent configuration
  agentType: 'browser_automation',
  systemPrompt: `You are a Recruiter Assistant AI specialized in helping recruiting professionals manage their talent acquisition workflow more efficiently.

Your core responsibilities:
- Screen resumes against job requirements and extract key qualifications
- Source candidates from LinkedIn, job boards, and professional networks
- Draft personalized outreach messages for different candidate types
- Schedule and coordinate interviews across multiple calendars
- Track candidate pipeline stages and follow-up timing
- Research salary data and market compensation trends
- Generate candidate summaries and comparison reports
- Automate follow-up sequences for passive candidates

You have access to browser automation, email, calendar, and data processing tools. When evaluating candidates:
1. Extract structured data (experience, skills, education, contact info)
2. Match requirements against qualifications with scoring
3. Identify red flags and standout achievements
4. Assess cultural fit based on provided criteria
5. Provide data-driven hiring recommendations

Be professional, unbiased, and focus on finding the best talent match while respecting candidate privacy and employment laws.`,
  suggestedModel: 'claude-sonnet-4-5-20250929',

  // Requirements
  requiredTools: ['browser', 'http', 'email', 'data'],
  optionalTools: ['calendar', 'ai', 'drive'],
  requiredIntegrations: [],

  // Sample workflows
  sampleWorkflows: [
    {
      id: 'resume-screening',
      name: 'Automated Resume Screening',
      description: 'Screen incoming resumes against job requirements and rank candidates',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'drive.listFiles',
          description: 'Fetch resumes from Google Drive folder',
          params: {
            folderId: '{{resume_folder_id}}',
            mimeType: 'application/pdf',
            limit: 50,
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'drive.readFile',
          description: 'Extract text from each resume',
          params: {
            fileIds: '{{resume_file_ids}}',
          },
          estimatedCredits: 100,
        },
        {
          order: 3,
          tool: 'ai.analyze',
          description: 'Extract candidate qualifications',
          params: {
            prompt: 'Extract from this resume: 1) Years of experience, 2) Key skills, 3) Education, 4) Previous companies, 5) Contact info. Format as structured JSON. Resume: {{resume_text}}',
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'ai.analyze',
          description: 'Score candidates against job requirements',
          params: {
            prompt: 'Score this candidate (0-100) for the {{job_title}} role. Job requirements: {{job_requirements}}. Candidate profile: {{candidate_profile}}. Provide: Overall Score, Skills Match %, Experience Match %, Top 3 Strengths, Top 3 Concerns.',
          },
          estimatedCredits: 250,
        },
        {
          order: 5,
          tool: 'data.sort',
          description: 'Rank candidates by score',
          params: {
            field: 'overall_score',
            order: 'desc',
          },
          estimatedCredits: 10,
        },
        {
          order: 6,
          tool: 'email.send',
          description: 'Send screening report',
          params: {
            to: '{{hiring_manager_email}}',
            subject: 'Resume Screening Complete: {{job_title}} - Top {{count}} Candidates',
            body: 'I screened {{total_resumes}} resumes for the {{job_title}} position. Here are the top candidates:\n\n{{ranked_candidates}}\n\nFull screening report attached.',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'linkedin-sourcing',
      name: 'LinkedIn Candidate Sourcing',
      description: 'Search LinkedIn for candidates matching job criteria and extract profiles',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.navigate',
          description: 'Navigate to LinkedIn search',
          params: {
            url: 'https://www.linkedin.com/search/results/people/?keywords={{keywords}}&location={{location}}',
            waitFor: 'networkidle',
          },
          estimatedCredits: 60,
        },
        {
          order: 2,
          tool: 'browser.extract',
          description: 'Extract candidate profile links',
          params: {
            selectors: {
              profiles: '.reusable-search__result-container',
              name: '.entity-result__title-text a',
              headline: '.entity-result__primary-subtitle',
              location: '.entity-result__secondary-subtitle',
              profileUrl: '.entity-result__title-text a[href]',
            },
            limit: 25,
          },
          estimatedCredits: 120,
        },
        {
          order: 3,
          tool: 'browser.navigate',
          description: 'Visit each candidate profile',
          params: {
            urls: '{{profile_urls}}',
            delay: 3000, // Avoid rate limiting
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'browser.extract',
          description: 'Extract detailed profile information',
          params: {
            selectors: {
              experience: '.experience-section .pvs-list__item',
              education: '.education-section .pvs-list__item',
              skills: '.skills-section .pvs-list__item',
              about: '.about-section .inline-show-more-text',
            },
          },
          estimatedCredits: 150,
        },
        {
          order: 5,
          tool: 'ai.analyze',
          description: 'Assess candidate fit',
          params: {
            prompt: 'Assess this LinkedIn profile for {{job_title}} role. Requirements: {{job_requirements}}. Profile data: {{profile_data}}. Provide: Fit Score (0-100), Key Strengths, Potential Concerns, Recommended Outreach Approach.',
          },
          estimatedCredits: 300,
        },
        {
          order: 6,
          tool: 'drive.createSheet',
          description: 'Create candidate pipeline spreadsheet',
          params: {
            title: 'LinkedIn Sourcing - {{job_title}} - {{date}}',
            data: '{{candidate_assessments}}',
          },
          estimatedCredits: 30,
        },
      ],
    },
    {
      id: 'candidate-outreach',
      name: 'Personalized Candidate Outreach',
      description: 'Generate and send personalized outreach emails to candidates',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch candidate list from ATS',
          params: {
            url: '{{ats_api_endpoint}}/candidates',
            headers: {
              Authorization: 'Bearer {{api_key}}',
            },
            query: {
              stage: 'sourced',
              status: 'not_contacted',
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'ai.generate',
          description: 'Generate personalized outreach email for each candidate',
          params: {
            prompt: 'Write a personalized recruiting outreach email for {{candidate_name}} who is a {{current_title}} at {{current_company}}. Job: {{job_title}} at {{company_name}}. Reference their experience in {{relevant_skill}} and why this role is a great next step. Keep it under 150 words, warm and professional.',
          },
          estimatedCredits: 200,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Generate subject lines',
          params: {
            prompt: 'Create 3 compelling email subject lines for recruiting outreach to {{candidate_name}} about the {{job_title}} role. Avoid spam triggers, be personable.',
          },
          estimatedCredits: 50,
        },
        {
          order: 4,
          tool: 'email.sendBatch',
          description: 'Send outreach emails',
          params: {
            recipients: '{{candidate_emails}}',
            subject_template: '{{selected_subject_line}}',
            body_template: '{{personalized_email}}',
            trackOpens: true,
          },
          estimatedCredits: 50,
        },
        {
          order: 5,
          tool: 'http.post',
          description: 'Update ATS candidate status',
          params: {
            url: '{{ats_api_endpoint}}/candidates/{{candidate_id}}/status',
            body: {
              stage: 'contacted',
              last_contact_date: '{{date}}',
              notes: 'Automated outreach sent via AI assistant',
            },
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'interview-coordination',
      name: 'Interview Scheduling Automation',
      description: 'Coordinate interview availability and send calendar invites',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'calendar.checkAvailability',
          description: 'Check interviewer availability',
          params: {
            calendarIds: '{{interviewer_calendars}}',
            timeRange: '{{preferred_date_range}}',
            duration: '{{interview_duration}}',
          },
          estimatedCredits: 30,
        },
        {
          order: 2,
          tool: 'ai.analyze',
          description: 'Find optimal time slots',
          params: {
            prompt: 'Given these availability windows: {{availability_data}}, suggest 5 optimal interview time slots that work for all {{interviewer_count}} interviewers. Consider: timezone differences, work hours, avoiding back-to-back meetings.',
          },
          estimatedCredits: 100,
        },
        {
          order: 3,
          tool: 'email.send',
          description: 'Send scheduling email to candidate',
          params: {
            to: '{{candidate_email}}',
            subject: 'Interview Scheduling: {{job_title}} at {{company_name}}',
            body: 'Hi {{candidate_name}},\n\nWe\'d love to schedule an interview for the {{job_title}} position. Here are some available time slots:\n\n{{time_slot_options}}\n\nPlease reply with your preferred time, or suggest an alternative if none work.\n\nBest regards,\n{{recruiter_name}}',
          },
          estimatedCredits: 5,
        },
        {
          order: 4,
          tool: 'calendar.createEvent',
          description: 'Create calendar event once confirmed',
          params: {
            title: 'Interview: {{candidate_name}} - {{job_title}}',
            start: '{{confirmed_time}}',
            duration: '{{interview_duration}}',
            attendees: ['{{candidate_email}}', '{{interviewer_emails}}'],
            description: 'Interview for {{job_title}} position.\n\nCandidate: {{candidate_name}}\nResume: {{resume_link}}\n\nInterview format: {{format}}\nVideo link: {{video_link}}',
            location: '{{interview_location}}',
          },
          estimatedCredits: 20,
        },
        {
          order: 5,
          tool: 'email.send',
          description: 'Send interview prep to interviewers',
          params: {
            to: '{{interviewer_emails}}',
            subject: 'Interview Prep: {{candidate_name}} - {{date}}',
            body: 'Interview scheduled for {{date}} at {{time}}.\n\nCandidate: {{candidate_name}}\nRole: {{job_title}}\n\nCandidate Summary:\n{{candidate_summary}}\n\nSuggested Questions:\n{{interview_questions}}\n\nResume: {{resume_link}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'follow-up-automation',
      name: 'Candidate Follow-up Sequences',
      description: 'Send automated follow-up emails based on candidate stage',
      trigger: 'scheduled',
      schedule: '0 10 * * 1,3,5', // Mon, Wed, Fri at 10 AM
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch candidates needing follow-up',
          params: {
            url: '{{ats_api_endpoint}}/candidates',
            query: {
              needs_follow_up: true,
              days_since_last_contact: '>3',
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'data.filter',
          description: 'Segment candidates by stage',
          params: {
            groupBy: 'stage',
          },
          estimatedCredits: 10,
        },
        {
          order: 3,
          tool: 'ai.generate',
          description: 'Generate stage-appropriate follow-up',
          params: {
            prompt: 'Write a follow-up email for {{candidate_name}} in {{stage}} stage. Last contact: {{days_ago}} days ago. Previous notes: {{notes}}. Keep it brief, warm, and include a clear next step.',
          },
          estimatedCredits: 150,
        },
        {
          order: 4,
          tool: 'email.sendBatch',
          description: 'Send follow-up emails',
          params: {
            recipients: '{{candidate_emails}}',
            subject_template: 'Following up - {{job_title}} at {{company_name}}',
            body_template: '{{personalized_follow_up}}',
          },
          estimatedCredits: 40,
        },
      ],
    },
  ],

  // Custom instructions template
  customInstructionsTemplate: `Recruiting Information:
- Company Name: [Your company]
- Industry: [Industry]
- Company Size: [Employees]
- Typical Roles Hired: [Job types]
- Hiring Volume: [Hires per month]

Job Requirements Template:
- Required Skills: [List]
- Nice-to-Have Skills: [List]
- Years of Experience: [Range]
- Education Requirements: [Degree level]
- Location: [Remote/Hybrid/Onsite]

Candidate Sourcing:
- Primary Sources: [LinkedIn/Indeed/Glassdoor/etc]
- Target Companies: [List competitors/relevant companies]
- Target Job Titles: [Titles to search]

Communication Preferences:
- Recruiter Name: [Your name]
- Email Signature: [Your signature]
- Company Career Page: [URL]
- Tone: [Professional/Casual/Friendly]`,

  // Success metrics
  suggestedKPIs: [
    'Resumes screened per day',
    'Candidates sourced per week',
    'Interview-to-offer ratio',
    'Time-to-fill (days)',
    'Candidate response rate',
    'Offer acceptance rate',
  ],

  // Default configuration
  defaultConfig: {
    maxSteps: 30,
    maxCreditsPerTask: 800,
    timeoutSeconds: 600,
    retryAttempts: 2,
    requireApproval: false,
  },

  // Tier and visibility
  tier: 'core', // Available to Core+ tiers (involves sensitive candidate data)
  featured: true,
  order: 4,
};
