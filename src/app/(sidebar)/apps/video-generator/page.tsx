'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { VideoGeneratorForm, type GeneratedVideo } from '@/components/VideoGeneratorForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Clapperboard } from 'lucide-react';

export default function VideoGeneratorPage() {
  const { status } = useSession();
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Kept above the auth early-returns for the same reason the image generator
  // page documents: returning before a hook runs changes the hook count between
  // renders and throws "Rendered more hooks than during the previous render".
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/videos?limit=20&offset=0');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setVideos(data.videos ?? []);
      } catch {
        // A failed history load should not block generating a new video.
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'unauthenticated') {
    redirect('/api/auth/signin');
  }

  if (status === 'loading') {
    return null;
  }

  const handleGenerated = (video: GeneratedVideo) => {
    setVideos((prev) => [video, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Video Generator</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Turn a written shot description into a short video clip for ads, social posts and product teasers
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="sticky top-8 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle>Generate video</CardTitle>
                <CardDescription>Describe the shot you want</CardDescription>
              </CardHeader>
              <CardContent>
                <VideoGeneratorForm
                  onGenerate={handleGenerated}
                  onLoading={setIsGenerating}
                  isLoading={isGenerating}
                />
              </CardContent>
            </Card>

            <Card className="mt-6 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                      Writing a good shot
                    </p>
                    <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                      <li>• Name the camera move — &ldquo;slow push-in&rdquo;, &ldquo;drone drift&rdquo;</li>
                      <li>• Describe the lighting and mood</li>
                      <li>• Say what should NOT happen — models take negatives seriously</li>
                      <li>• Vertical 9:16 for Reels and TikTok, 16:9 for web</li>
                      <li>• Longer clips and higher resolutions cost more credits</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg">Your videos</CardTitle>
                <CardDescription>
                  {isLoadingList ? 'Loading…' : `${videos.length} video${videos.length === 1 ? '' : 's'}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isLoadingList && videos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Clapperboard className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nothing here yet. Describe a shot to generate your first clip.
                    </p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  {videos.map((video) => (
                    <figure
                      key={video.id}
                      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black"
                    >
                      {/* controls, not autoplay: these are user-owned assets to
                          review, not ambient decoration like the landing page. */}
                      <video
                        src={video.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className={
                          video.aspectRatio === '9:16'
                            ? 'w-full aspect-[9/16] object-contain bg-black'
                            : 'w-full aspect-video object-contain bg-black'
                        }
                      />
                      <figcaption className="p-3 bg-white dark:bg-gray-900 space-y-2">
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-gray-500 dark:text-gray-400">
                          <span>{video.aspectRatio}</span>
                          <span>{video.resolution}</span>
                          <span>{video.durationSeconds}s</span>
                          <span className="tabular-nums">{video.creditsUsed} cr</span>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
