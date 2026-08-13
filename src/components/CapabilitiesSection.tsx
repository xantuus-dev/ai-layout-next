/* "What Xantuus actually does" — six capability cards in the style of the
   supercool.com capabilities grid: art panel, title, bullets, footer caption.
   Art is hand-drawn SVG in public/capabilities, sized 800x500 to match the
   16/10 panel; swap `art` for any raster render and the <img> handles it. */

const CAPABILITIES: {
  title: string;
  bullets: string[];
  caption: string;
  art: string;
}[] = [
  {
    title: 'Documents & Copy',
    bullets: [
      'Marketing emails: campaigns, launches, follow-ups',
      'Proposals & reports: structured business writing',
      'Blog posts & social: on-brand, ready to publish',
      'Product descriptions: listings at scale',
    ],
    caption: 'Drafts arrive formatted and ready to edit',
    art: '/capabilities/documents.svg',
  },
  {
    title: 'Images & Graphics',
    bullets: [
      'AI images: custom illustrations from a prompt',
      'Graphics: social media and listing assets',
      'On-brand: match your colors and style',
      'PNG or JPG, any resolution',
    ],
    caption: 'Image generation built in — no separate subscription',
    art: '/capabilities/images.svg',
  },
  {
    title: 'Every Model, One Chat',
    bullets: [
      'Claude, GPT, and Gemini behind one interface',
      'Pick the right model per task — or let us route it',
      'No vendor lock-in, no five subscriptions',
      'One credit balance meters everything',
    ],
    caption: 'Backed by Anthropic, OpenAI, and Google models',
    art: '/capabilities/models.svg',
  },
  {
    title: 'Templates',
    bullets: [
      'Ready-to-run prompts for real business tasks',
      'Fill in the blanks — no prompt engineering',
      'Organized by category, tier, and use case',
      'Save your own for the tasks you repeat',
    ],
    caption: 'Start from a template, not a blank page',
    art: '/capabilities/templates.svg',
  },
  {
    title: 'Workflows & Automation',
    bullets: [
      'Turn any repeated task into a workflow',
      'Chain steps: research → draft → deliver',
      'Runs on schedule or on demand',
      'Visual builder — no code required',
    ],
    caption: 'The work you repeat every week, on autopilot',
    art: '/capabilities/workflows.svg',
  },
  {
    title: 'Connected to Your Tools',
    bullets: [
      'Gmail: drafts delivered to your outbox',
      'Google Drive: files in, documents out',
      'Calendar: scheduling handled for you',
      'Team workspace with shared credits',
    ],
    caption: 'Finished work lands where you already live',
    art: '/capabilities/integrations.svg',
  },
];

export default function CapabilitiesSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 py-20 border-t border-border">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-4">
          What Xantuus actually does
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          Real business output. <span className="text-gradient">In minutes.</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Not just chat responses. Drafts, images, and automations — finished and delivered where
          you work.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CAPABILITIES.map((cap) => (
          <div
            key={cap.title}
            className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            <img src={cap.art} alt="" className="m-3 rounded-xl aspect-[16/10] w-[calc(100%-1.5rem)] object-cover" />
            <div className="px-6 pt-3 pb-6 flex flex-col flex-1">
              <h3 className="text-lg font-bold text-foreground mb-3">{cap.title}</h3>
              <ul className="space-y-2 mb-5">
                {cap.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-primary shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-4 border-t border-border text-xs text-muted-foreground">
                {cap.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
