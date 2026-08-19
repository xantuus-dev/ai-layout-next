/**
 * One-off script: generate cinematic showcase images for the landing page
 * ShowcaseGallery and save them into public/showcase/, replacing the
 * hand-drawn placeholder SVGs.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/generate-showcase-images.ts
 *
 * Uses OpenAI gpt-image-1. Swap PROVIDER to 'gemini' to use
 * gemini-2.5-flash-image instead (requires a valid GOOGLE_AI_API_KEY).
 */
import { writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const PROVIDER: 'openai' | 'gemini' = 'openai';

const ITEMS: { id: string; kind: 'image' | 'video'; prompt: string; caption: string }[] = [
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
    prompt:
      'Ultra high-speed studio product photograph of a vivid mixed-berry smoothie pouring into a tall glass, ' +
      'mid-splash droplets frozen in motion, condensation on the glass, dramatic three-point studio lighting on a ' +
      'reflective black surface, saturated magenta and orange gradient background, commercial beverage advertising, 8k',
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
];

async function generateWithOpenAI(prompt: string): Promise<Buffer> {
  const client = new OpenAI();
  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1536x1024',
    quality: 'high',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  return Buffer.from(b64, 'base64');
}

async function main() {
  if (PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const outDir = path.join(process.cwd(), 'public', 'showcase');

  for (const item of ITEMS) {
    console.log(`Generating ${item.id}...`);
    const buffer = await generateWithOpenAI(item.prompt);
    const outPath = path.join(outDir, `${item.id}.png`);
    await writeFile(outPath, buffer);
    console.log(`  -> ${outPath} (${(buffer.byteLength / 1024).toFixed(0)}KB)`);
  }

  console.log('Done. Update SHOWCASE_ITEMS in src/components/ShowcaseGallery.tsx to point at the .png files.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
