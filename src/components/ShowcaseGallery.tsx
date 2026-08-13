import { Play, ImageIcon, Clapperboard } from 'lucide-react';

/* Card art is hand-drawn SVG in public/showcase — vector, so it stays crisp
   at any card size. To use a real AI render later, point `art` at the new
   file; the <img> below handles any raster format the same way. */
const SHOWCASE_ITEMS: {
  kind: 'image' | 'video';
  prompt: string;
  duration?: string;
  art: string;
}[] = [
  {
    kind: 'image',
    prompt: 'Neon jellyfish drifting through a deep indigo ocean, cinematic light',
    art: '/showcase/jellyfish.svg',
  },
  {
    kind: 'video',
    prompt: 'Product launch teaser — smoothie pour in slow motion, studio lighting',
    duration: '0:14',
    art: '/showcase/smoothie.svg',
  },
  {
    kind: 'image',
    prompt: 'Golden-hour mountain ridge above a sea of clouds, ultra wide',
    art: '/showcase/mountains.svg',
  },
  {
    kind: 'image',
    prompt: 'Isometric cyberpunk street market at night, rain reflections',
    art: '/showcase/cyberpunk.svg',
  },
  {
    kind: 'video',
    prompt: 'Animated brand story — logo morphing through liquid color',
    duration: '0:22',
    art: '/showcase/brandstory.svg',
  },
  {
    kind: 'image',
    prompt: 'Minimal product shot — matcha jar on emerald silk, soft shadows',
    art: '/showcase/matcha.svg',
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
            <img
              src={item.art}
              alt={item.prompt}
              className="aspect-[4/3] w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />

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
