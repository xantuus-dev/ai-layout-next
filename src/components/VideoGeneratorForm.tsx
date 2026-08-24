'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Clapperboard, AlertCircle, Clock } from 'lucide-react';
import { getVideoGenerationCost } from '@/lib/credits';

/** Hints for the ratios we recognise. An unknown ratio still renders — it just
 *  shows without a hint — so a provider adding one needs no change here. */
const ASPECT_HINTS: Record<string, string> = {
  '16:9': 'YouTube, web, presentations',
  '9:16': 'Reels, TikTok, Shorts',
  '1:1': 'Feed posts',
  '4:3': 'Classic',
  '3:4': 'Portrait',
  '21:9': 'Cinematic ultrawide',
};

/**
 * Clips longer than this cannot finish inside a serverless request. Both
 * providers poll against their own deadline (280s) to stay under the route's
 * maxDuration of 300, so a long Seedance generation fails on time rather than
 * being killed. Warn before the user spends credits on one.
 */
const INLINE_SAFE_MAX_SECONDS = 10;

const MAX_PROMPT = 1000;

interface ProviderInfo {
  id: string;
  label: string;
  models: string[];
  defaultModel: string;
  capabilities: {
    aspectRatios: string[];
    resolutions: string[];
    durationsSeconds: number[];
    typicalRuntimeMs: number;
  };
}

export interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  creditsUsed: number;
  createdAt: string;
}

interface VideoGeneratorFormProps {
  onGenerate?: (video: GeneratedVideo) => void;
  onLoading?: (isLoading: boolean) => void;
  isLoading?: boolean;
}

/** Keep the current value when the new provider supports it, else fall back. */
function reconcile<T>(current: T, supported: readonly T[], preferred?: T): T {
  if (supported.includes(current)) return current;
  if (preferred !== undefined && supported.includes(preferred)) return preferred;
  return supported[0];
}

export function VideoGeneratorForm({
  onGenerate,
  onLoading,
  isLoading = false,
}: VideoGeneratorFormProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [providerId, setProviderId] = useState<string>('');

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [durationSeconds, setDurationSeconds] = useState('8');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId]
  );

  // Load what can actually run. Options are built from this rather than a
  // hardcoded list, because the two providers differ on every axis.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/videos/providers');
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const list: ProviderInfo[] = data.providers ?? [];
        setProviders(list);

        const first = list.find((p) => p.id === data.defaultProviderId) ?? list[0];
        if (first) {
          setProviderId(first.id);
          setAspectRatio(reconcile('16:9', first.capabilities.aspectRatios));
          setResolution(reconcile('720p', first.capabilities.resolutions));
          setDurationSeconds(String(reconcile(8, first.capabilities.durationsSeconds)));
        }
      } catch {
        // Leave the defaults in place; the route validates regardless.
      } finally {
        if (!cancelled) setProvidersLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Tick only while generating; always clear so navigating away mid-run does
  // not leave an interval behind.
  useEffect(() => {
    if (!isLoading) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
      return;
    }
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isLoading]);

  const handleProviderChange = useCallback(
    (nextId: string) => {
      const next = providers.find((p) => p.id === nextId);
      if (!next) return;
      setProviderId(nextId);
      // Carry the current selections across where the new provider supports
      // them, so switching to compare models does not reset the whole form.
      setAspectRatio((current) => reconcile(current, next.capabilities.aspectRatios, '16:9'));
      setResolution((current) => reconcile(current, next.capabilities.resolutions, '720p'));
      setDurationSeconds((current) =>
        String(reconcile(Number(current), next.capabilities.durationsSeconds, 8))
      );
    },
    [providers]
  );

  const cost = getVideoGenerationCost(Number(durationSeconds), resolution, provider?.id, provider?.defaultModel);
  const isLongClip = Number(durationSeconds) > INLINE_SAFE_MAX_SECONDS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Describe the video you want to create.');
      return;
    }
    if (trimmed.length < 10) {
      setError('Add a bit more detail — at least 10 characters.');
      return;
    }
    if (trimmed.length > MAX_PROMPT) {
      setError(`Keep the prompt under ${MAX_PROMPT} characters.`);
      return;
    }

    onLoading?.(true);

    try {
      const response = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          aspectRatio,
          resolution,
          durationSeconds,
          // Naming the model is what selects the provider server-side; without
          // it the registry falls back to whichever is registered first.
          ...(provider ? { model: provider.defaultModel } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Statuses come from failureStatus() in src/lib/media/types.ts — each
        // has a different fix, so each gets its own message.
        switch (response.status) {
          case 401:
            setError('Your session expired. Sign in again to keep generating.');
            break;
          case 402:
            setError(
              data.creditsNeeded && data.creditsAvailable !== undefined
                ? `This needs ${data.creditsNeeded} credits and you have ${data.creditsAvailable}. Shorten the clip, drop the resolution, or top up.`
                : data.error || 'Not enough credits for this video.'
            );
            break;
          case 429:
            setError(
              data.retryAfter
                ? `Rate limit reached. Try again in ${Math.ceil(data.retryAfter / 60)} minute(s).`
                : 'Rate limit reached. Try again shortly.'
            );
            break;
          case 502:
            // The provider itself refused. Quota exhaustion lands here, and its
            // own message is the only thing that says which provider and why.
            setError(`${provider?.label ?? 'The provider'} rejected the request: ${data.error || 'unknown error'}`);
            break;
          case 503:
            setError(data.error || 'No video provider is configured on this deployment.');
            break;
          default:
            setError(data.error || 'Could not generate the video.');
        }
        return;
      }

      setSuccessMessage('Video ready.');
      setPrompt('');
      onGenerate?.(data.video);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      onLoading?.(false);
    }
  };

  if (providersLoaded && providers.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No video provider is configured. Set <code>GOOGLE_AI_API_KEY</code> for Veo or{' '}
          <code>FAL_KEY</code> for Seedance.
        </AlertDescription>
      </Alert>
    );
  }

  const caps = provider?.capabilities;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {providers.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="video-provider" className="text-sm font-semibold">Model</Label>
          <Select value={providerId} onValueChange={handleProviderChange} disabled={isLoading}>
            <SelectTrigger id="video-provider"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="video-prompt" className="text-sm font-semibold">Describe the shot</Label>
        <textarea
          id="video-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Slow push-in on a mixed-berry smoothie pouring into a tall glass, studio lighting, glossy commercial look"
          className="w-full min-h-28 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-vertical"
          disabled={isLoading}
        />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {prompt.length}/{MAX_PROMPT} characters — describe the subject, camera movement and lighting
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-aspect" className="text-sm font-semibold">Format</Label>
        <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isLoading || !caps}>
          <SelectTrigger id="video-aspect"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(caps?.aspectRatios ?? []).map((value) => (
              <SelectItem key={value} value={value}>
                {value}
                {ASPECT_HINTS[value] ? ` — ${ASPECT_HINTS[value]}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="video-duration" className="text-sm font-semibold">Length</Label>
          <Select value={durationSeconds} onValueChange={setDurationSeconds} disabled={isLoading || !caps}>
            <SelectTrigger id="video-duration"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(caps?.durationsSeconds ?? []).map((value) => (
                <SelectItem key={value} value={String(value)}>{value} seconds</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-resolution" className="text-sm font-semibold">Resolution</Label>
          <Select value={resolution} onValueChange={setResolution} disabled={isLoading || !caps}>
            <SelectTrigger id="video-resolution"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(caps?.resolutions ?? []).map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-4 py-3">
        <span className="text-sm text-gray-600 dark:text-gray-400">Estimated cost</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {cost.toLocaleString()} credits
        </span>
      </div>

      {isLongClip && !isLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Clips over {INLINE_SAFE_MAX_SECONDS}s often exceed the request timeout and fail before
            returning. Credits are only spent on a successful generation, but expect long clips to
            time out until background jobs are wired up.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && !error && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading || !provider} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating… {elapsed}s
          </>
        ) : (
          <>
            <Clapperboard className="w-4 h-4 mr-2" />
            Generate video
          </>
        )}
      </Button>

      {isLoading && (
        <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Generation usually takes a few minutes and can run to five. Keep this tab open — closing
            it cancels the request.
          </span>
        </p>
      )}
    </form>
  );
}
