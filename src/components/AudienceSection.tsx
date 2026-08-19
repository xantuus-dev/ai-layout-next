/* "Who Xantuus is built for" — nine-card audience grid in the style of the
   supercool.com "Built for the People Who Ship" section: a real photo per
   card, a green outline, and a glow on hover. Copy is adapted to the
   business audiences Xantuus actually serves (see /solutions and the home
   page FEATURES list) instead of supercool's video/creator niche.

   Photos are real Unsplash images (via the images.unsplash.com remote
   pattern already allow-listed in next.config.js), chosen by actually
   viewing each candidate rather than guessing IDs — content matches what's
   in frame, not just a plausible-sounding filename. */

import Image from 'next/image';

const AUDIENCES: {
  photo: string;
  title: string;
  lines: [string, string];
}[] = [
  {
    photo: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=75',
    title: 'Founders & Small Business',
    lines: ['Your emails, your website copy, your pitch deck.', 'Drafted tonight, ready tomorrow.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=75',
    title: 'Marketers & Agencies',
    lines: ['Ten client deliverables before lunch.', 'No tool-hopping, one credit balance.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=75',
    title: 'Sales Teams',
    lines: ['Prospecting emails and proposals.', 'Drafted, on-brand, ready to send.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=800&q=75',
    title: 'Coaches & Consultants',
    lines: ['Proposals, reports, and client decks.', 'Structured business writing, not chat scraps.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=75',
    title: 'Executives & Leaders',
    lines: ['Board decks, reports, and keynotes.', 'Strategy to slides, without the all-nighter.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=75',
    title: 'Operations Teams',
    lines: ['The task you repeat every week.', 'Turned into a workflow that runs itself.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1553775282-20af80779df7?w=800&q=75',
    title: 'Customer Support',
    lines: ['Agents that triage and draft replies.', 'A human signs off before anything ships.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=75',
    title: 'Freelancers & Creators',
    lines: ['Blog posts, captions, listings.', 'On-brand and ready to publish.'],
  },
  {
    photo: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=800&q=75',
    title: 'IT & Admins',
    lines: ['Governance and approval checkpoints.', 'Agents that act, but never unsupervised.'],
  },
];

export default function AudienceSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 py-20 border-t border-border">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
          Built for the <span className="text-gradient">People Who Ship.</span>
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {AUDIENCES.map((a) => (
          <div
            key={a.title}
            className="group rounded-2xl border-2 border-emerald-500/40 bg-card overflow-hidden transition-all duration-300 hover:border-emerald-400 hover:shadow-[0_0_28px_rgba(16,185,129,0.45)] hover:-translate-y-1"
          >
            <div className="relative h-44 w-full">
              <Image
                src={a.photo}
                alt={a.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
            <div className="p-6">
              <h3 className="font-bold text-foreground mb-2">{a.title}</h3>
              <p className="text-sm text-muted-foreground">
                {a.lines[0]}
                <br />
                {a.lines[1]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
