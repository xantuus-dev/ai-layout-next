/**
 * List the video providers that can actually run right now.
 *
 * The generator UI builds its format/length/resolution choices from this rather
 * than hardcoding one vendor's enum: Veo does 16:9 and 9:16 at 4/6/8 seconds,
 * Seedance does six aspect ratios and 4-30 seconds. Offering the union would
 * produce requests that fail validation; offering Veo's subset would hide what
 * Seedance can do.
 *
 * Unconfigured providers are omitted entirely — a provider with no credentials
 * is not a choice, so it should never reach the picker.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listConfiguredVideoProviders } from '@/lib/video-providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providers = listConfiguredVideoProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
      models: [...provider.models],
      defaultModel: provider.defaultModel,
      capabilities: {
        aspectRatios: [...provider.capabilities.aspectRatios],
        resolutions: [...provider.capabilities.resolutions],
        durationsSeconds: [...provider.capabilities.durationsSeconds],
        typicalRuntimeMs: provider.capabilities.typicalRuntimeMs,
      },
    }));

    // Registration order is preference order (see the video-providers registry),
    // so the first entry is what a request with no model resolves to.
    return NextResponse.json({ providers, defaultProviderId: providers[0]?.id ?? null });
  } catch (error) {
    console.error('Error listing video providers:', error);
    return NextResponse.json({ error: 'Failed to list video providers' }, { status: 500 });
  }
}
