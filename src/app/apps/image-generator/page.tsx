'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import SidebarLayout from '@/components/SidebarLayout';
import { ImageGeneratorForm } from '@/components/ImageGeneratorForm';
import { ImageGalleryGrid } from '@/components/ImageGalleryGrid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  creditsUsed: number;
  createdAt: string;
  model: string;
}

interface PaginationState {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export default function ImageGeneratorPage() {
  const { data: session, status } = useSession();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    redirect('/api/auth/signin');
  }

  if (status === 'loading') {
    return null;
  }

  // Fetch images
  const fetchImages = async (offset = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(
        `/api/images?limit=${pagination.limit}&offset=${offset}&sortBy=recent`
      );
      const data = await response.json();

      if (response.ok) {
        setImages((prev) => (append ? [...prev, ...data.images] : data.images));
        setPagination({
          limit: data.pagination.limit,
          offset: data.pagination.offset,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore,
        });
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Load initial images
  useEffect(() => {
    fetchImages(0, false);
  }, []);

  // Handle generate image
  const handleImageGenerated = (image: GeneratedImage) => {
    setImages((prev) => [image, ...prev]);
    setPagination((prev) => ({
      ...prev,
      total: prev.total + 1,
    }));
  };

  // Handle load more
  const handleLoadMore = () => {
    const newOffset = pagination.offset + pagination.limit;
    fetchImages(newOffset, true);
  };

  // Handle image deleted
  const handleImageDeleted = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setPagination((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }));
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Image Generator
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Create stunning images for your pitch decks, marketing materials, and business content
            </p>
          </div>

          {/* Two-Column Layout */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Form */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardHeader>
                  <CardTitle>Generate Image</CardTitle>
                  <CardDescription>
                    Describe your ideal image
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageGeneratorForm
                    onGenerate={handleImageGenerated}
                    onLoading={setIsLoading}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>

              {/* Tips Card */}
              <Card className="mt-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                        Pro Tips
                      </p>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                        <li>• Be specific about style (e.g., "modern", "professional")</li>
                        <li>• Include color preferences</li>
                        <li>• Mention lighting and mood</li>
                        <li>• Larger sizes use more credits</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Gallery */}
            <div className="lg:col-span-2 space-y-4">
              {/* Stats Card */}
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Total Generated</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {pagination.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">This Page</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {images.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Images Gallery */}
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                  <ImageGalleryGrid
                    images={images}
                    isLoading={isLoadingMore}
                    onLoadMore={handleLoadMore}
                    hasMore={pagination.hasMore}
                    onImageDeleted={handleImageDeleted}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
