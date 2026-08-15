import {
  Bot,
  Workflow,
  ShieldCheck,
  BarChart3,
  Brain,
  Plug,
  GitBranch,
  Clock,
  Repeat,
  FileSearch,
  Lock,
  Eye,
  KeyRound,
  ScrollText,
  LineChart,
  Database,
  Share2,
  Bell,
  Users,
  Layers,
  type LucideIcon,
} from 'lucide-react';

export interface SolutionFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface SolutionStep {
  title: string;
  description: string;
}

export interface SolutionUseCase {
  title: string;
  description: string;
}

export interface SolutionFaq {
  question: string;
  answer: string;
}

export interface Solution {
  /** URL segment under /solutions */
  slug: string;
  /** Card + nav label */
  name: string;
  icon: LucideIcon;
  badge?: string;
  eyebrow: string;
  /** Hero headline, split so the second half renders in the brand gradient */
  headline: string;
  headlineAccent: string;
  subhead: string;
  /** Short line reused on the /solutions index and the /contact cards */
  summary: string;
  /** Button label on the /contact card — kept distinct per card by design */
  ctaLabel: string;
  /**
   * Prefills the "Service Interested In" select on /contact. Must match one of
   * the <option> values on that page or the select falls back to unselected.
   */
  contactService: string;
  stats: { value: string; label: string }[];
  features: SolutionFeature[];
  steps: SolutionStep[];
  useCases: SolutionUseCase[];
  faqs: SolutionFaq[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'ai-agents',
    name: 'AI Agents',
    icon: Bot,
    badge: 'Popular',
    eyebrow: 'Autonomous work, supervised',
    headline: 'Agents that finish the work,',
    headlineAccent: 'not just the sentence',
    subhead:
      'Give an agent a goal, the tools it needs, and the guardrails you are comfortable with. It plans, calls your systems, and reports back — on Claude, GPT, or Gemini, whichever handles the task best.',
    summary:
      'Build intelligent agents that automate complex workflows and decision-making processes.',
    ctaLabel: 'Learn More',
    contactService: 'AI Agent',
    stats: [
      { value: '3', label: 'Model families, one agent runtime' },
      { value: '20+', label: 'Built-in tools and integrations' },
      { value: 'Minutes', label: 'From prompt to a running agent' },
    ],
    features: [
      {
        icon: Brain,
        title: 'Multi-step reasoning',
        description:
          'Agents break a goal into steps, run them in order, and adapt when a step returns something unexpected — instead of failing on the first surprise.',
      },
      {
        icon: Plug,
        title: 'Connected to your stack',
        description:
          'Gmail, Google Drive, Calendar, Slack, and your own APIs via API keys. An agent can read a doc, draft the reply, and book the follow-up in one run.',
      },
      {
        icon: GitBranch,
        title: 'Model routing per step',
        description:
          'Use a fast model for classification and a frontier model for the judgment call. You pay for the reasoning you actually need, metered in credits.',
      },
      {
        icon: ShieldCheck,
        title: 'Approval checkpoints',
        description:
          'Mark any step as human-approved. The agent pauses, shows its plan and its evidence, and waits for a person before it acts.',
      },
      {
        icon: ScrollText,
        title: 'Full run transcripts',
        description:
          'Every tool call, input, and output is recorded. When someone asks why the agent did that, the answer is one click away.',
      },
      {
        icon: Repeat,
        title: 'Reusable templates',
        description:
          'Save a working agent as a template with typed variables so the rest of the team runs it without rewriting the prompt.',
      },
    ],
    steps: [
      {
        title: 'Describe the outcome',
        description:
          'Write the goal in plain language — "triage new support email and draft a reply in our tone" — and pick the tools the agent may use.',
      },
      {
        title: 'Test against real inputs',
        description:
          'Run the agent on your actual data in a sandbox. Inspect each step, tighten the instructions, and set which actions need approval.',
      },
      {
        title: 'Ship it and watch the runs',
        description:
          'Trigger on a schedule, a webhook, or a button. Usage lands in your credit dashboard so cost per run is never a mystery.',
      },
    ],
    useCases: [
      {
        title: 'Inbox triage',
        description:
          'Classify incoming mail, pull the customer record, and draft a reply for review — before anyone opens the inbox.',
      },
      {
        title: 'Research briefs',
        description:
          'Point an agent at a company, a market, or a competitor and get a sourced brief with links instead of a wall of unverified prose.',
      },
      {
        title: 'Document processing',
        description:
          'Extract structured fields from contracts, invoices, or forms, then write them to your system of record.',
      },
    ],
    faqs: [
      {
        question: 'Can an agent act without a human in the loop?',
        answer:
          'Yes, but it is opt-in per action. Read-only steps typically run unattended while anything that sends, pays, or deletes can require approval.',
      },
      {
        question: 'Which model does an agent use?',
        answer:
          'Whichever you assign — Claude, GPT, or Gemini — and you can assign different models to different steps of the same agent.',
      },
      {
        question: 'How is it priced?',
        answer:
          'Agents draw from the same credit balance as chat. There is no per-agent or per-seat fee; you pay for tokens actually consumed.',
      },
    ],
  },
  {
    slug: 'automation',
    name: 'Automation',
    icon: Workflow,
    badge: 'New',
    eyebrow: 'The work that repeats itself',
    headline: 'Turn the task you do every week into',
    headlineAccent: 'a workflow that runs itself',
    subhead:
      'Chain prompts, integrations, and conditions into a workflow with a visual builder. Trigger it on a schedule, a webhook, or an event — and get the output where your team already works.',
    summary:
      'Streamline your operations with AI-powered automation solutions.',
    ctaLabel: 'Explore',
    contactService: 'Automation',
    stats: [
      { value: '0', label: 'Lines of code to build one' },
      { value: '24/7', label: 'Scheduled and event triggers' },
      { value: '1', label: 'Credit balance across every run' },
    ],
    features: [
      {
        icon: Workflow,
        title: 'Visual workflow builder',
        description:
          'Drag steps onto a canvas, wire them together, and see the data shape at every hop. No YAML, no glue scripts to maintain.',
      },
      {
        icon: Clock,
        title: 'Schedules and triggers',
        description:
          'Run nightly, hourly, on a webhook, or when a file lands in Drive. The workflow starts without anyone remembering to start it.',
      },
      {
        icon: GitBranch,
        title: 'Branching and conditions',
        description:
          'Route on the model output — escalate the angry ticket, auto-close the duplicate — so one workflow covers the whole decision tree.',
      },
      {
        icon: Repeat,
        title: 'Retries and error handling',
        description:
          'Transient API failures retry with backoff instead of dropping the run. Failures notify you with the step and the payload attached.',
      },
      {
        icon: Layers,
        title: 'Template library',
        description:
          'Start from a ready-made workflow for reporting, outreach, or content, then change the parts specific to your business.',
      },
      {
        icon: Bell,
        title: 'Output where you work',
        description:
          'Deliver results to email, Slack, a Google Doc, a spreadsheet, or your own endpoint — not to a dashboard nobody opens.',
      },
    ],
    steps: [
      {
        title: 'Pick the repeating task',
        description:
          'The weekly report, the follow-up sequence, the data cleanup. If a person does it the same way every time, it is a candidate.',
      },
      {
        title: 'Build it on the canvas',
        description:
          'Add prompt steps, integration steps, and conditions. Run it once with real inputs and inspect the output of every step.',
      },
      {
        title: 'Put it on a trigger',
        description:
          'Schedule it or wire a webhook. Runs, costs, and failures are visible in one place, so the automation stays accountable.',
      },
    ],
    useCases: [
      {
        title: 'Weekly reporting',
        description:
          'Pull numbers from your sources, have a model write the narrative, and drop a formatted doc in the shared folder every Monday.',
      },
      {
        title: 'Lead follow-up',
        description:
          'Enrich a new lead, draft a personalized first touch, and queue it for a human to send — within minutes of the form submission.',
      },
      {
        title: 'Price and content monitoring',
        description:
          'Watch a set of pages on a schedule, summarize what changed, and alert only when the change actually matters.',
      },
    ],
    faqs: [
      {
        question: 'Do I need an engineer to set one up?',
        answer:
          'No. The builder is visual and the templates cover common patterns. Engineers are useful when you want to call your own internal APIs.',
      },
      {
        question: 'What happens when a run fails?',
        answer:
          'The step retries with backoff. If it still fails, the run is marked failed, you are notified, and the full input and error are kept for debugging.',
      },
      {
        question: 'Can workflows call agents?',
        answer:
          'Yes. A workflow step can invoke an agent for the open-ended part of the job while the deterministic steps stay deterministic.',
      },
    ],
  },
  {
    slug: 'ai-security',
    name: 'AI Security',
    icon: ShieldCheck,
    eyebrow: 'Governance for the AI your team already uses',
    headline: 'Ship AI without',
    headlineAccent: 'losing the audit trail',
    subhead:
      'Know which models your team is using, what data reaches them, and who did what. Xantuus puts access control, retention, and a complete usage record around every AI call.',
    summary:
      'Protect your AI systems with advanced security measures and monitoring.',
    ctaLabel: 'Discover',
    contactService: 'AI Security',
    stats: [
      { value: '100%', label: 'Of AI calls logged and attributable' },
      { value: 'SSO', label: 'Google, Microsoft, and Apple' },
      { value: 'Per-key', label: 'Scoping and revocation' },
    ],
    features: [
      {
        icon: KeyRound,
        title: 'Access control and SSO',
        description:
          'Sign-in through Google, Microsoft Entra, or Apple. Team roles decide who can spend credits, edit workflows, or reach an integration.',
      },
      {
        icon: ScrollText,
        title: 'Complete usage records',
        description:
          'Every request is written to a usage record with user, model, tokens, and credits — the trail an auditor asks for and shadow AI never has.',
      },
      {
        icon: Lock,
        title: 'Scoped API keys',
        description:
          'Issue keys per service, see when each was last used, and revoke one without rotating the rest of your estate.',
      },
      {
        icon: FileSearch,
        title: 'Data retention controls',
        description:
          'Set how long conversations and generated artifacts are kept. Retention runs on a schedule instead of depending on someone remembering.',
      },
      {
        icon: Eye,
        title: 'Spend and anomaly visibility',
        description:
          'Watch credit burn by user and by model. A workflow that suddenly costs ten times more is visible the same day, not at invoice time.',
      },
      {
        icon: ShieldCheck,
        title: 'Approval gates on risky actions',
        description:
          'Require a human sign-off before an agent sends mail, writes to a system of record, or touches production data.',
      },
    ],
    steps: [
      {
        title: 'Consolidate the tools',
        description:
          'Replace scattered personal accounts with one workspace so AI usage stops happening outside your visibility.',
      },
      {
        title: 'Set the policy',
        description:
          'Configure roles, integration scopes, retention windows, and which actions need approval — once, for the whole team.',
      },
      {
        title: 'Review the record',
        description:
          'Usage, spend, and key activity are queryable from day one, so security review is reading a report rather than running an investigation.',
      },
    ],
    useCases: [
      {
        title: 'Eliminating shadow AI',
        description:
          'Give the team a sanctioned tool that is better than the consumer account they were using, and get the logs as a side effect.',
      },
      {
        title: 'Vendor and client due diligence',
        description:
          'Answer the security questionnaire with actual controls: SSO, RBAC, retention policy, revocable keys, and full request logging.',
      },
      {
        title: 'Cost governance',
        description:
          'Attribute AI spend to teams and workflows, then cap or re-route the ones that do not justify a frontier model.',
      },
    ],
    faqs: [
      {
        question: 'Is our data used to train models?',
        answer:
          'No. Requests go to the model providers under their API terms, which exclude API traffic from training. Your retention settings govern what Xantuus stores.',
      },
      {
        question: 'Can we restrict which models a team may use?',
        answer:
          'Yes. Model access is a workspace setting, so you can keep sensitive workloads on the providers your policy allows.',
      },
      {
        question: 'What do you keep after we delete a conversation?',
        answer:
          'The conversation content is removed on your retention schedule. The usage record — user, model, tokens, credits — is kept for billing and audit.',
      },
    ],
  },
  {
    slug: 'dashboards',
    name: 'Dashboards',
    icon: BarChart3,
    eyebrow: 'Numbers with the explanation attached',
    headline: 'Dashboards that tell you',
    headlineAccent: 'what changed and why',
    subhead:
      'Live views of usage, spend, and workflow output — plus an AI narrative that explains the movement instead of leaving you to squint at a line chart.',
    summary:
      'Visualize your data with intelligent, AI-enhanced dashboards.',
    ctaLabel: 'View Demos',
    contactService: 'Dashboards',
    stats: [
      { value: 'Live', label: 'Usage and credit burn' },
      { value: 'Per-model', label: 'Cost and token breakdown' },
      { value: 'Export', label: 'To PDF, DOCX, or your warehouse' },
    ],
    features: [
      {
        icon: LineChart,
        title: 'Usage and spend analytics',
        description:
          'Credits consumed by user, model, and day, drawn from the same usage records that drive billing — so the chart and the invoice agree.',
      },
      {
        icon: Brain,
        title: 'AI-written summaries',
        description:
          'Each view comes with a short narrative: what moved, by how much, and the most likely driver — generated from the underlying rows.',
      },
      {
        icon: Database,
        title: 'Your data, not just ours',
        description:
          'Feed a dashboard from a workflow, an uploaded file, or your own API, and let a model normalize the messy parts on the way in.',
      },
      {
        icon: Bell,
        title: 'Thresholds and alerts',
        description:
          'Set a ceiling on daily credit burn or a floor on a business metric and get notified when a run crosses it.',
      },
      {
        icon: Share2,
        title: 'Shareable and exportable',
        description:
          'Send a link, or export a formatted PDF or DOCX for the people who will only ever read it in an email.',
      },
      {
        icon: Users,
        title: 'Team and workspace views',
        description:
          'Roll up by workspace for the executive summary, or drill into a single user or workflow when a number looks wrong.',
      },
    ],
    steps: [
      {
        title: 'Connect the source',
        description:
          'Start with built-in usage and billing data, then add your own via a workflow step, an upload, or an API call.',
      },
      {
        title: 'Choose the view',
        description:
          'Pick the metrics that matter, set the comparison window, and let the model draft the narrative that accompanies them.',
      },
      {
        title: 'Put it in front of people',
        description:
          'Share the link, schedule the export, or wire an alert so the dashboard reaches your team instead of waiting for a visit.',
      },
    ],
    useCases: [
      {
        title: 'AI spend review',
        description:
          'See exactly where credits went last month by team, model, and workflow — and which of those runs earned their cost.',
      },
      {
        title: 'Operational reporting',
        description:
          'Turn workflow output into a recurring report that lands in the same place, in the same format, every period.',
      },
      {
        title: 'Executive summaries',
        description:
          'One page, plain language, generated from the live numbers — for the meeting where nobody wants to open a BI tool.',
      },
    ],
    faqs: [
      {
        question: 'Where does the dashboard data come from?',
        answer:
          'Usage and billing views read your workspace usage records. Custom views read whatever source you connect through a workflow or API.',
      },
      {
        question: 'Do the AI summaries cost credits?',
        answer:
          'Yes, a small amount per generation — they are ordinary model calls, metered like everything else, and you choose the model.',
      },
      {
        question: 'Can I export the underlying data?',
        answer:
          'Yes. Views export to PDF and DOCX for reading, and the raw usage records are available through the API for your warehouse.',
      },
    ],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((solution) => solution.slug === slug);
}
