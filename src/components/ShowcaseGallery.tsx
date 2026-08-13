import { Play, ImageIcon, Clapperboard } from 'lucide-react';

/* Placeholder art built from layered CSS gradients so the section ships
   without binary assets — swap any card's `art` for a real render by
   replacing the styled div with an <img>/<video> of the same aspect. */
const SHOWCASE_ITEMS: {
  kind: 'image' | 'video';
  prompt: string;
  duration?: string;
  art: React.CSSProperties;
}[] = [
  {
    kind: 'image',
    prompt: 'Neon jellyfish drifting through a deep indigo ocean, cinematic light',
    art: {
      background:
        'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(168,85,247,0.9), transparent 60%), radial-gradient(ellipse 70% 70% at 75% 70%, rgba(236,72,153,0.8), transparent 65%), radial-gradient(ellipse 90% 80% at 50% 100%, rgba(59,130,246,0.7), transparent 70%), #0f0524',
    },
  },
  {
    kind: 'video',
    prompt: 'Product launch teaser — smoothie pour in slow motion, studio lighting',
    duration: '0:14',
    art: {
      background:
        'radial-gradient(ellipse 90% 70% at 20% 80%, rgba(16,185,129,0.9), transparent 60%), radial-gradient(ellipse 70% 60% at 80% 20%, rgba(132,204,22,0.75), transparent 60%), radial-gradient(ellipse 100% 90% at 60% 60%, rgba(13,148,136,0.6), transparent 75%), #031712',
    },
  },
  {
    kind: 'image',
    prompt: 'Golden-hour mountain ridge above a sea of clouds, ultra wide',
    art: {
      background:
        'radial-gradient(ellipse 90% 60% at 50% 90%, rgba(251,146,60,0.95), transparent 65%), radial-gradient(ellipse 80% 50% at 20% 30%, rgba(244,63,94,0.6), transparent 60%), radial-gradient(ellipse 70% 60% at 85% 15%, rgba(253,224,71,0.5), transparent 55%), #1c0a02',
    },
  },
  {
    kind: 'image',
    prompt: 'Isometric cyberpunk street market at night, rain reflections',
    art: {
      background:
        'radial-gradient(ellipse 70% 70% at 75% 25%, rgba(34,211,238,0.85), transparent 60%), radial-gradient(ellipse 80% 60% at 20% 75%, rgba(217,70,239,0.85), transparent 65%), radial-gradient(ellipse 90% 90% at 50% 50%, rgba(99,102,241,0.5), transparent 75%), #0a0118',
    },
  },
  {
    kind: 'video',
    prompt: 'Animated brand story — logo morphing through liquid color',
    duration: '0:22',
    art: {
      background:
        'radial-gradient(ellipse 80% 70% at 30% 30%, rgba(45,212,191,0.9), transparent 60%), radial-gradient(ellipse 70% 80% at 80% 75%, rgba(129,140,248,0.85), transparent 65%), radial-gradient(ellipse 100% 80% at 50% 100%, rgba(14,165,233,0.55), transparent 70%), #020d1c',
    },
  },
  {
    kind: 'image',
    prompt: 'Minimal product shot — matcha jar on emerald silk, soft shadows',
    art: {
      background:
        'radial-gradient(ellipse 80% 60% at 60% 35%, rgba(52,211,153,0.9), transparent 60%), radial-gradient(ellipse 90% 70% at 15% 85%, rgba(16,185,129,0.7), transparent 65%), radial-gradient(ellipse 60% 50% at 90% 90%, rgba(163,230,53,0.5), transparent 55%), #04140c',
    },
  },
];

export default function ShowcaseGallery() {
  return (
    <section className="relative max-w-6xl mx-auto px-4 md:px-8 py-20 border-t border-border">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          Images. Video. <span className="text-gradient">Made from a sentence.</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Type what you want and get on-brand visuals back — no design tools, no stock-photo
          subscriptions, no video editor.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SHOWCASE_ITEMS.map((item) => (
          <figure
            key={item.prompt}
            className="group relative rounded-2xl overflow-hidden border border-border shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all"
          >
            <div className="aspect-[4/3] w-full" style={item.art} />

            {item.kind === 'video' && (
              <>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                  </span>
                </span>
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-xs font-mono text-white">
                  {item.duration}
                </span>
              </>
            )}

            <figcaption className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
                {item.kind === 'video' ? (
                  <Clapperboard className="w-3.5 h-3.5" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                {item.kind === 'video' ? 'AI video' : 'AI image'}
              </span>
              <span className="block text-sm text-white/90 font-mono leading-snug">
                “{item.prompt}”
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
