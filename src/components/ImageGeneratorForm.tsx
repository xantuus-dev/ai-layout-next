'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wand2, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { ImageTemplateSelector } from './ImageTemplateSelector';
import { getImageGenerationCost } from '@/lib/credits';

interface Template {
  id: string;
  name: string;
  prompt: string;
  defaultWidth: number;
  defaultHeight: number;
}

interface ImageGeneratorFormProps {
  onGenerate?: (image: any) => void;
  onLoading?: (isLoading: boolean) => void;
  isLoading?: boolean;
}

export function ImageGeneratorForm({
  onGenerate,
  onLoading,
  isLoading = false,
}: ImageGeneratorFormProps) {
  const [prompt, setPrompt] = useState('');
  const [width, setWidth] = useState('1024');
  const [height, setHeight] = useState('1024');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const sizes = [
    { label: 'Small (512x512)', value: '512' },
    { label: 'Medium (1024x1024)', value: '1024' },
    { label: 'Large (1536x1536)', value: '1536' },
  ];

  const handleTemplateSelect = (template: Template) => {
    setPrompt(template.prompt);
    setWidth(template.defaultWidth.toString());
    setHeight(template.defaultHeight.toString());
  };

  // Calculate cost for current settings
  const costPerImage = getImageGenerationCost(parseInt(width), parseInt(height));
  const totalCost = costPerImage * parseInt(quantity);

  // Get cost label
  const getCostLabel = (credits: number) => {
    if (credits <= 5) return { label: '💚 Budget-friendly', color: 'text-green-600 dark:text-green-400' };
    if (credits <= 15) return { label: '⚡ Standard', color: 'text-blue-600 dark:text-blue-400' };
    return { label: '🔥 Premium', color: 'text-orange-600 dark:text-orange-400' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (prompt.trim().length < 10) {
      setError('Prompt must be at least 10 characters long');
      return;
    }

    if (prompt.trim().length > 1000) {
      setError('Prompt must be less than 1000 characters');
      return;
    }

    onLoading?.(true);

    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          width: parseInt(width),
          height: parseInt(height),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          setError('Insufficient credits. Please upgrade your plan.');
        } else if (response.status === 429) {
          setError('Rate limit exceeded. Maximum 10 images per hour.');
        } else {
          setError(data.error || 'Failed to generate image');
        }
        return;
      }

      setSuccessMessage('Image generated successfully!');
      setPrompt('');
      onGenerate?.(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      onLoading?.(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prompt Input */}
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-sm font-semibold">
          Image Prompt
        </Label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to create... (e.g., 'A modern tech startup office with blue and purple lighting, spacious and collaborative')"
          className="w-full min-h-24 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          disabled={isLoading}
        />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {prompt.length}/1000 characters
        </div>
      </div>

      {/* Template Selector Button */}
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowTemplateSelector(true)}
          disabled={isLoading}
          className="w-full text-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Use Template
        </Button>
      </div>

      {/* Quantity Selector */}
      <div className="space-y-2">
        <Label htmlFor="quantity" className="text-sm font-semibold">
          Generate Quantity
        </Label>
        <Select value={quantity} onValueChange={setQuantity} disabled={isLoading}>
          <SelectTrigger id="quantity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((num) => (
              <SelectItem key={num} value={num.toString()}>
                {num} {num === 1 ? 'image' : 'images'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Generate multiple variations in one batch
        </div>
      </div>

      {/* Size Selection */}
      <div className="space-y-2">
        <Label htmlFor="size" className="text-sm font-semibold">
          Image Size
        </Label>
        <Select value={width} onValueChange={(val) => { setWidth(val); setHeight(val); }} disabled={isLoading}>
          <SelectTrigger id="size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Larger images consume more credits
        </div>
      </div>

      {/* Cost Preview Card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Generation Cost
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Per image</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {costPerImage} credits
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total ({quantity}x)</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {totalCost} credits
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getCostLabel(costPerImage).color}`}>
              {getCostLabel(costPerImage).label}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar (shown during generation) */}
      {isLoading && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Generating your image...
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              This typically takes 20-30 seconds
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate Image
          </>
        )}
      </Button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 Tip: Be specific about styles, colors, and composition for best results
      </p>
    </form>

    {/* Template Selector Modal */}
    <ImageTemplateSelector
      isOpen={showTemplateSelector}
      onClose={() => setShowTemplateSelector(false)}
      onSelect={handleTemplateSelect}
    />
  </>
  );
}
