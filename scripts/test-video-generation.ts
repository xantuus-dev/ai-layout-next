/**
 * Generate one real clip, straight through the provider.
 *
 * Bypasses the API route deliberately: no session, no credit deduction, no rate
 * limit, no GeneratedVideo row. That isolates "does generation actually work"
 * from "is the app wired up correctly", which are different failures.
 *
 * COSTS REAL MONEY. Defaults are the cheapest combination the provider offers
 * (4s @ 480p ~= $0.88 on Seedance). The script prints the estimate and refuses
 * to run without --yes, so a stray re-run cannot spend by accident.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-video-generation.ts --yes
 *   npx tsx --env-file=.env.local scripts/test-video-generation.ts --yes \
 *     --seconds=6 --resolution=720p --aspect=9:16 --prompt="..."
 */
import { writeFile } from 'fs/promises';
import path from 'path';
import { getVideoProviderForModel, listConfiguredVideoProviders } from '../src/lib/video-providers';
import { getVideoGenerationCost } from '../src/lib/credits';

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const DEFAULT_PROMPT =
  'Slow push-in on a tall glass of iced coffee on a clean white counter, condensation ' +
  'beading on the glass, soft morning window light, shallow depth of field, calm and premium. ' +
  'The glass stays upright and nothing spills.';

async function main() {
  const seconds = Number(arg('seconds', '4'));
  const resolution = arg('resolution', '480p');
  const aspectRatio = arg('aspect', '16:9');
  const prompt = arg('prompt', DEFAULT_PROMPT);
  const model = arg('model', '');

  const configured = listConfiguredVideoProviders();
  if (configured.length === 0) {
    throw new Error('No video provider is configured. Set FAL_KEY (Seedance) or GOOGLE_AI_API_KEY (Veo).');
  }

  const provider = getVideoProviderForModel(model || undefined);
  if (!provider) throw new Error(`No configured provider serves model "${model}".`);

  // Model matters as much as provider: Atlas serves 2.5 and 2.0 Mini at very
  // different rates, so omitting it quotes the dearest model's price.
  const credits = getVideoGenerationCost(seconds, resolution, provider.id, model || provider.defaultModel);
  const dollars = credits * 0.001; // 1 credit ~= $0.001 of provider cost

  console.log('Video generation test\n');
  console.log(`  provider    ${provider.label} (${provider.id})`);
  console.log(`  model       ${model || provider.defaultModel}`);
  console.log(`  format      ${aspectRatio} · ${resolution} · ${seconds}s`);
  console.log(`  cost        ${credits.toLocaleString()} credits (~$${dollars.toFixed(2)} of provider spend)`);
  console.log(`  prompt      ${prompt.slice(0, 72)}${prompt.length > 72 ? '…' : ''}\n`);

  // Fail loudly rather than silently spending on an option the provider rejects.
  const caps = provider.capabilities;
  if (!caps.aspectRatios.includes(aspectRatio)) {
    throw new Error(`${provider.label} supports aspect ratios: ${caps.aspectRatios.join(', ')}`);
  }
  if (!caps.resolutions.includes(resolution)) {
    throw new Error(`${provider.label} supports resolutions: ${caps.resolutions.join(', ')}`);
  }
  if (!caps.durationsSeconds.includes(seconds)) {
    throw new Error(`${provider.label} supports lengths (s): ${caps.durationsSeconds.join(', ')}`);
  }

  if (!process.argv.includes('--yes')) {
    console.log('Dry run. Re-run with --yes to actually spend the amount above.');
    return;
  }

  console.log('Generating — this runs for minutes. Do not interrupt.\n');
  const started = Date.now();

  const result = await provider.generateVideo({
    prompt,
    aspectRatio,
    resolution,
    durationSeconds: seconds,
    ...(model ? { model } : {}),
    userId: 'cli-test',
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
  console.log(`  model returned  ${result.model}`);
  console.log(`  url             ${result.videoUrl}`);

  // Pull a local copy so the clip can be inspected without hitting Blob again.
  try {
    const response = await fetch(result.videoUrl);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const out = path.join(process.cwd(), `test-clip-${Date.now()}.mp4`);
      await writeFile(out, buffer);
      console.log(`  saved           ${path.basename(out)} (${(buffer.byteLength / 1048576).toFixed(2)} MB)`);
    }
  } catch {
    console.log('  (could not download a local copy; the URL above still works)');
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
