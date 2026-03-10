'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Trash2, Download, Copy, Check, Share2 } from 'lucide-react';
import { format } from 'date-fns';

interface ImagePreviewCardProps {
  id: string;
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  creditsUsed: number;
  createdAt: string;
  onDelete?: (id: string) => void;
}

export function ImagePreviewCard({
  id,
  imageUrl,
  prompt,
  width,
  height,
  creditsUsed,
  createdAt,
  onDelete,
}: ImagePreviewCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch(`/api/images/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Image - ${format(new Date(createdAt), 'MMM d, yyyy')}`,
          allowDownload: true,
          allowShare: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.shareLink.shareUrl);
        navigator.clipboard.writeText(data.shareLink.shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Error creating share link:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/images/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete?.(id);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image Container */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <Image
          src={imageUrl}
          alt={prompt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={false}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownload}
            className="rounded-full"
            title="Download image"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShare}
            disabled={isSharing}
            className="rounded-full"
            title="Share image"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-full"
            title="Delete image"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-3">
        {/* Prompt */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Prompt
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {prompt}
          </p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Size</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {width}x{height}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Credits</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {creditsUsed}
            </p>
          </div>
        </div>

        {/* Date */}
        <p className="text-xs text-gray-400 dark:text-gray-600">
          {format(new Date(createdAt), 'MMM d, yyyy HH:mm')}
        </p>

        {/* Copy Prompt Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopyPrompt}
          className="w-full text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 mr-1" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" /> Copy Prompt
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
