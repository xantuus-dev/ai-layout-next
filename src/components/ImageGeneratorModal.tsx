'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (imageUrl: string) => void;
}

export function ImageGeneratorModal({
  isOpen,
  onClose,
  onInsert,
}: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  const handleGenerate = async () => {
    setError('');

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          width: parseInt(size),
          height: parseInt(size),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate image');
        return;
      }

      setGeneratedImageUrl(data.image.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    if (generatedImageUrl) {
      onInsert?.(generatedImageUrl);
      handleClose();
    }
  };

  const handleClose = () => {
    setPrompt('');
    setSize('1024');
    setError('');
    setGeneratedImageUrl('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Image</DialogTitle>
          <DialogDescription>
            Create an image to include in your message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="quick-prompt">Describe your image</Label>
            <Input
              id="quick-prompt"
              placeholder="E.g., Modern office building with glass windows"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || !!generatedImageUrl}
            />
          </div>

          {/* Size Selection */}
          <div className="space-y-2">
            <Label htmlFor="quick-size">Size</Label>
            <Select value={size} onValueChange={setSize} disabled={isLoading || !!generatedImageUrl}>
              <SelectTrigger id="quick-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="512">Small (512×512, 5 credits)</SelectItem>
                <SelectItem value="1024">Medium (1024×1024, 15 credits)</SelectItem>
                <SelectItem value="1536">Large (1536×1536, 30 credits)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Generated Image Preview */}
          {generatedImageUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Image generated!</p>
              <img
                src={generatedImageUrl}
                alt={prompt}
                className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {generatedImageUrl ? 'Cancel' : 'Close'}
            </Button>
            {!generatedImageUrl ? (
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleInsert}
                className="bg-green-600 hover:bg-green-700"
              >
                Insert Image
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
