/**
 * One-off script: generate the cinematic showcase assets for the landing page
 * ShowcaseGallery and save them into public/showcase/, replacing the
 * hand-drawn placeholder SVGs.
 *
 * Stills come from OpenAI gpt-image-1. The two `video` items additionally get a
 * real Veo clip, and their still doubles as the <video> poster frame so the card
 * has something sharp to show before the clip loads.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-showcase-images.ts
 *   npx tsx --env-file=.env.local scripts/generate-showcase-images.ts --only=smoothie
 *   npx tsx --env-file=.env.local scripts/generate-showcase-images.ts --force
 *
 * Needs OPENAI_API_KEY for stills and GOOGLE_AI_API_KEY for clips. Existing
 * files are skipped unless --force, so a re-run after one item fails does not
 * re-buy the items that already succeeded.
 */
import { writeFile, access } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { veoVideoService, type VeoAspectRatio } from '../src/lib/video-generation';

type Item = {
  id: string;
  kind: 'image' | 'video';
  caption: string;
  prompt: string;
  /** Motion prompt for Veo. Required on `video` items — the still prompt above
   *  describes a frozen instant, which makes for a static, lifeless clip.
   *
   *  It must describe the SAME moment as `prompt`, because the still is used as
   *  the clip's poster frame. If the still shows a full glass and the clip opens
   *  on an empty one, the card visibly jump-cuts the instant the video loads. */
  videoPrompt?: string;
  /** Delivery format this card is demonstrating. Vertical pillars (viral shorts,
   *  UGC) must render 9:16 — a landscape clip contradicts the claim the card is
   *  making. Defaults to 16:9. */
  aspectRatio?: VeoAspectRatio;
};

const ITEMS: Item[] = [
  {
    id: 'jellyfish',
    kind: 'image',
    caption: 'Neon jellyfish drifting through a deep indigo ocean, cinematic light',
    prompt:
      'Hyper-realistic underwater photograph of a bioluminescent jellyfish drifting through deep indigo ocean water, ' +
      'neon cyan and magenta tendrils glowing, volumetric light shafts from above, tiny suspended particulates, ' +
      'shot on a full-frame camera with a macro lens, shallow depth of field, ultra-detailed, moody cinematic color grade, 8k',
  },
  {
    id: 'smoothie',
    kind: 'video',
    caption: 'Product launch teaser — smoothie pour in slow motion, studio lighting',
    aspectRatio: '9:16',
    // Splash/drip language was deliberately removed from both prompts: asking for
    // "droplets arcing and splashing" and "condensation beading down the glass"
    // made Veo run smoothie down the OUTSIDE of the glass and pool it on the
    // surface, which reads as a spill rather than a product shot.
    //
    // Both prompts below pin the same three things, because Veo will otherwise
    // default to a stemless wine glass full of a thin translucent red liquid —
    // which reads as a wine pour, not a smoothie:
    //   1. glass geometry  — tall, straight-sided, no stem, no curved bowl
    //   2. liquid opacity  — thick, opaque, matte, seed-flecked (not translucent)
    //   3. the same moment — glass already two-thirds full, pour still running
    prompt:
      'Ultra high-speed vertical studio product photograph of a vivid opaque mixed-berry smoothie pouring into a ' +
      'TALL STRAIGHT-SIDED highball glass — a tall cylindrical tumbler with flat vertical sides, no stem and no ' +
      'curved bowl. The glass is already two-thirds full of thick opaque bright magenta-pink blended smoothie with ' +
      'visible berry seeds and a matte non-transparent surface; a smooth thick ribbon of the same smoothie pours ' +
      'straight down into the centre from above and sinks cleanly into the surface. The pour is fully contained: ' +
      'the outside of the glass is spotless and dry, and the reflective black surface around the base is clean and ' +
      'dry. Dramatic three-point studio lighting, saturated magenta-to-orange gradient background, commercial ' +
      'beverage advertising, 8k. Not a wine glass, not a stemless glass, not a transparent liquid, not wine or ' +
      'juice. No splashing, no spills, no drips running down the outside of the glass, no puddles or scattered ' +
      'droplets on the surface.',
    videoPrompt:
      'Vertical slow-motion commercial beverage shot. A TALL STRAIGHT-SIDED highball glass — a tall cylindrical ' +
      'tumbler with flat vertical sides, no stem, no curved bowl — stands on a clean dry reflective black surface, ' +
      'already two-thirds full of thick opaque bright magenta-pink mixed-berry smoothie. A heavy ribbon of the same ' +
      'thick opaque smoothie pours straight down into the centre of the glass, the level rising smoothly and ' +
      'settling just below the rim. The pour is clean and completely contained — the liquid stays inside the glass, ' +
      'the outside of the glass stays spotless and dry, and the surface around the base stays clean. The smoothie ' +
      'is completely non-transparent with a matte blended texture and visible berry seeds. Dramatic three-point ' +
      'studio lighting, saturated magenta-to-orange gradient backdrop, slow push-in, shallow depth of field, ' +
      'glossy premium advertising look. Not a wine glass, not a stemless glass, not a thin translucent liquid, ' +
      'not wine. Nothing splashes over the rim, nothing runs down the outside of the glass, no spills, no puddles ' +
      'or scattered droplets on the surface, no text, no logos.',
  },
  {
    id: 'mountains',
    kind: 'image',
    caption: 'Golden-hour mountain ridge above a sea of clouds, ultra wide',
    prompt:
      'Breathtaking golden-hour landscape photograph of a jagged mountain ridge rising above a rolling sea of clouds, ' +
      'sun low on the horizon casting long warm rays, atmospheric haze, ultra-wide-angle lens, crisp detail on rock ' +
      'texture, epic scale, National Geographic style, 8k',
  },
  {
    id: 'cyberpunk',
    kind: 'image',
    caption: 'Isometric cyberpunk street market at night, rain reflections',
    prompt:
      'Detailed isometric digital illustration of a dense cyberpunk street market at night, neon signage in Japanese ' +
      'and English, rain-slicked pavement reflecting pink and cyan light, food stalls, holographic advertisements, ' +
      'crowds under umbrellas, intricate line work, vibrant color palette, concept-art quality',
  },
  {
    id: 'brandstory',
    kind: 'video',
    caption: 'Animated brand story — logo morphing through liquid color',
    prompt:
      'Abstract macro photograph of vividly colored liquid paint mid-swirl — teal, emerald, and violet ink diffusing ' +
      'through clear water, frozen at peak turbulence, studio backlight, extreme close-up, glossy high-contrast ' +
      'commercial motion-graphics still, 8k',
    videoPrompt:
      'Extreme macro of teal, emerald, and violet ink blooming and diffusing through clear water, tendrils unfurling ' +
      'and folding into each other, slowly resolving toward a clean symmetric swirl. Studio backlight, glossy ' +
      'high-contrast motion-graphics look, smooth continuous camera drift, no text, no logos.',
  },
  {
    id: 'matcha',
    kind: 'image',
    caption: 'Minimal product shot — matcha jar on emerald silk, soft shadows',
    prompt:
      'Minimalist commercial product photograph of a matte ceramic matcha jar resting on draped emerald silk, ' +
      'soft directional studio light, subtle long shadow, muted sage-green background, a few loose tea leaves ' +
      'scattered nearby, shallow depth of field, premium skincare-ad aesthetic, 8k',
  },
  {
    id: 'cinematic',
    kind: 'video',
    caption: 'Opening shot of an original series — neon rooftop, anamorphic',
    prompt:
      'Cinematic anamorphic film still from a prestige science-fiction drama series: a lone figure in a long coat ' +
      'stands on a rain-swept rooftop overlooking a neon-lit futuristic city at dusk, shallow depth of field, ' +
      'anamorphic lens flare, teal and amber color grade, wide 2.39:1 framing, 35mm film grain, dramatic key light, 8k',
    videoPrompt:
      'Cinematic anamorphic shot from a prestige drama series: a lone figure in a long coat stands on a rain-swept ' +
      'rooftop overlooking a neon-lit futuristic city at dusk. Rain streaks through the light, the coat moves in the ' +
      'wind, traffic lights drift far below. Slow deliberate dolly push toward the figure, shallow depth of field, ' +
      'anamorphic lens flare, teal and amber film grade, 35mm grain, no text, no logos.',
  },
  {
    id: 'ugc-creator',
    kind: 'video',
    caption: 'UGC ad in one click — creator testimonial, shot-on-phone look',
    // Same defect as `smoothie`: a selfie held at arm's length is a vertical
    // gesture, and UGC is delivered vertically. Rendering it 16:9 contradicts
    // the "shot-on-phone" claim the card makes.
    aspectRatio: '9:16',
    prompt:
      'Authentic vertical user-generated-content style photograph shot on a phone: a smiling creator holds a matte skincare ' +
      'bottle up toward the camera at arm’s length in a sunlit kitchen, natural window light, slightly handheld ' +
      'framing, warm homey background with houseplants, shallow phone-camera depth of field, unpolished ' +
      'influencer-testimonial aesthetic, high detail',
    videoPrompt:
      'User-generated-content style selfie video: a smiling creator holds a matte skincare bottle up close to a ' +
      'handheld phone camera in a sunlit kitchen, turning it to show the label while talking to camera and ' +
      'gesturing. Natural window light, gentle handheld motion, warm homey background with houseplants, unpolished ' +
      'authentic influencer-testimonial look, no text overlays, no logos.',
  },
];

/** Veo caps clips at 4, 6 or 8 seconds; 8 is the longest loop we can get. */
const VIDEO_DURATION_SECONDS = 8;
const VIDEO_RESOLUTION = '720p' as const;
/** Fallback for items that don't declare one — landscape suits the cinematic
 *  and abstract cards. Vertical pillars set `aspectRatio` on the item instead. */
const DEFAULT_ASPECT_RATIO: VeoAspectRatio = '16:9';

/** gpt-image-1 sizes, matched to the clip orientation so the poster frame and
 *  the clip it sits in front of are not different shapes. */
const STILL_SIZE: Record<VeoAspectRatio, '1536x1024' | '1024x1536'> = {
  '16:9': '1536x1024',
  '9:16': '1024x1536',
};

const OUT_DIR = path.join(process.cwd(), 'public', 'showcase');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask gpt-image-1 for WebP directly rather than the default PNG. A high-quality
 * 1536x1024 PNG lands around 2MB, which is a lot to commit and a lot to ship for
 * a card that renders a few hundred pixels wide; WebP at this quality is roughly
 * a tenth of that with no visible difference at card size, and saves adding
 * sharp purely to re-encode afterwards.
 */
async function generateStill(prompt: string, aspectRatio: VeoAspectRatio): Promise<Buffer> {
  const client = new OpenAI();
  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: STILL_SIZE[aspectRatio],
    quality: 'high',
    output_format: 'webp',
    output_compression: 82,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  return Buffer.from(b64, 'base64');
}

/**
 * Render a clip with Veo and pull the bytes back down.
 *
 * veoVideoService uploads to Vercel Blob and hands back a URL. Landing-page art
 * is better served as a static file — it rides the deployment CDN instead of
 * billing Blob egress on every visit — so the Blob copy is just a staging step.
 */
async function generateClip(prompt: string, aspectRatio: VeoAspectRatio): Promise<Buffer> {
  const { videoUrl } = await veoVideoService.generateVideo({
    prompt,
    aspectRatio,
    resolution: VIDEO_RESOLUTION,
    durationSeconds: VIDEO_DURATION_SECONDS,
    userId: 'showcase',
  });

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Could not download clip from ${videoUrl}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function kb(buffer: Buffer): string {
  return `${(buffer.byteLength / 1024).toFixed(0)}KB`;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

  const items = only ? ITEMS.filter((i) => only.includes(i.id)) : ITEMS;
  if (items.length === 0) {
    throw new Error(`No items matched --only. Valid ids: ${ITEMS.map((i) => i.id).join(', ')}`);
  }

  const needsVideo = items.some((i) => i.kind === 'video');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  if (needsVideo && !veoVideoService.isConfigured()) {
    throw new Error('GOOGLE_AI_API_KEY is not set — required for the video items');
  }

  const failures: string[] = [];

  for (const item of items) {
    const aspectRatio = item.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    const stillPath = path.join(OUT_DIR, `${item.id}.webp`);

    if (!force && (await exists(stillPath))) {
      console.log(`${item.id}: still exists, skipping (use --force to redo)`);
    } else {
      try {
        console.log(`${item.id}: generating ${aspectRatio} still...`);
        const buffer = await generateStill(item.prompt, aspectRatio);
        await writeFile(stillPath, buffer);
        console.log(`  -> ${path.relative(process.cwd(), stillPath)} (${kb(buffer)})`);
      } catch (error) {
        console.error(`  !! still failed: ${error instanceof Error ? error.message : error}`);
        failures.push(`${item.id} (still)`);
      }
    }

    if (item.kind !== 'video') continue;

    const clipPath = path.join(OUT_DIR, `${item.id}.mp4`);
    if (!force && (await exists(clipPath))) {
      console.log(`${item.id}: clip exists, skipping (use --force to redo)`);
      continue;
    }

    try {
      console.log(
        `${item.id}: generating ${VIDEO_DURATION_SECONDS}s ${aspectRatio} clip (Veo takes minutes)...`
      );
      const buffer = await generateClip(item.videoPrompt!, aspectRatio);
      await writeFile(clipPath, buffer);
      console.log(`  -> ${path.relative(process.cwd(), clipPath)} (${kb(buffer)})`);
    } catch (error) {
      console.error(`  !! clip failed: ${error instanceof Error ? error.message : error}`);
      failures.push(`${item.id} (clip)`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nFailed: ${failures.join(', ')}`);
    console.error('Re-run to retry only the missing pieces — finished files are skipped.');
    process.exit(1);
  }

  console.log('\nDone. ShowcaseGallery reads .webp/.mp4 from public/showcase by id.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
