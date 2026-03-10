'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Share2, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface SharedImage {
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  title?: string;
  message?: string;
  createdAt: string;
}

export default function SharedImagePage({ params }: { params: { token: string } }) {
  const [image, setImage] = useState<SharedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSharedImage = async () => {
      try {
        const response = await fetch(`/api/share/image/${params.token}`);
        if (!response.ok) {
          setError('Image not found or share link has expired');
          return;
        }
        const data = await response.json();
        setImage(data.image);
      } catch (err) {
        setError('Failed to load shared image');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedImage();
  }, [params.token]);

  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.imageUrl;
    link.download = `shared-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading shared image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Image not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {image.title || 'Shared Image'}
          </h1>
          {image.message && (
            <p className="text-gray-600 dark:text-gray-400">{image.message}</p>
          )}
        </div>

        {/* Image Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-auto bg-gray-100 dark:bg-gray-800">
              <Image
                src={image.imageUrl}
                alt={image.prompt}
                width={image.width}
                height={image.height}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {/* Prompt & Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Image Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Prompt
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{image.prompt}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Resolution
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {image.width}×{image.height}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Shared
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Share & Download</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleDownload}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Image
              </Button>
              <Button
                onClick={handleCopyUrl}
                variant="outline"
                className="w-full"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Share Link
                  </>
                )}
              </Button>
              <Button
                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${window.location.href}`)}
                variant="outline"
                className="w-full"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            This image was generated using{' '}
            <a href="/" className="font-semibold text-blue-600 hover:text-blue-700">
              Xantuus AI
            </a>{' '}
            Image Generator
          </p>
        </div>
      </div>
    </div>
  );
}
