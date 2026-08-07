/**
 * Verifies every Anthropic model id in the catalog actually resolves.
 *
 * The catalog once shipped `claude-haiku-4-5-20250529`, an id the API answers
 * with 404 — so selecting Haiku always failed in production. Nothing caught it
 * because no test talks to the API. This does.
 *
 *   npx tsx scripts/verify-model-ids.ts
 *
 * Requires ANTHROPIC_API_KEY. The Models API is free to call, so this is cheap
 * enough to run in CI on a schedule or before a release. Exits non-zero on the
 * first unresolvable id.
 */

import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

async function main() {
  const { ANTHROPIC_MODELS } = await import('../src/lib/ai-providers/catalog');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set — cannot verify model ids.');
    process.exit(2);
  }

  const client = new Anthropic({ apiKey });
  let failed = 0;

  for (const model of ANTHROPIC_MODELS) {
    try {
      // max_input_tokens is returned by the API but not yet in the SDK's
      // ModelInfo type, so it is read through a cast rather than dropped.
      const live = (await client.models.retrieve(model.id)) as unknown as {
        max_input_tokens?: number;
      };

      // The context window is a factual claim the catalog makes to callers;
      // check it too rather than only that the id exists.
      if (live.max_input_tokens !== undefined && live.max_input_tokens !== model.contextWindow) {
        console.error(
          `MISMATCH  ${model.id}: catalog contextWindow=${model.contextWindow}, API max_input_tokens=${live.max_input_tokens}`
        );
        failed++;
      } else {
        console.log(`ok        ${model.id}`);
      }
    } catch (error: any) {
      console.error(`FAIL      ${model.id}: ${error?.status ?? ''} ${error?.message ?? error}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} model id(s) failed verification.`);
    process.exit(1);
  }
  console.log(`\nAll ${ANTHROPIC_MODELS.length} model ids verified.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
