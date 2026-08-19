/**
 * Google Gemini Image Generation Service
 * Uses the Gemini 2.0 Flash model to generate images from text prompts
 */

import { uploadMedia } from './storage';

export interface GenerateImageParams {
  prompt: string;
  width?: number;
  height?: number;
  /** Scopes the stored object path. Falls back to 'anonymous' when absent. */
  userId?: string;
}

export interface GenerateImageResponse {
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
}

/** Supported aspect ratios for imageConfig.aspectRatio on gemini-2.5-flash-image. */
const ASPECT_RATIOS: { ratio: string; value: number }[] = [
  { ratio: '9:16', value: 9 / 16 },
  { ratio: '3:4', value: 3 / 4 },
  { ratio: '1:1', value: 1 },
  { ratio: '4:3', value: 4 / 3 },
  { ratio: '16:9', value: 16 / 9 },
];

function nearestAspectRatio(width: number, height: number): string {
  const target = width / height;
  return ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(candidate.value - target) < Math.abs(best.value - target) ? candidate : best
  ).ratio;
}

class GeminiImageService {
  // gemini-2.5-flash-image ("nano banana") is the current image-capable Gemini
  // model — image output comes back as an inlineData part on generateContent,
  // there is no separate :generateImage endpoint.
  readonly modelId = 'gemini-2.5-flash-image';

  constructor() {}

  isConfigured(): boolean {
    return !!process.env.GOOGLE_AI_API_KEY;
  }

  /**
   * Generate an image from a text prompt via Gemini's generateContent endpoint.
   */
  async generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API not configured');
    }

    const { prompt, width = 1024, height = 1024, userId } = params;

    // Validate prompt
    if (!prompt || prompt.trim().length < 10) {
      throw new Error('Prompt must be at least 10 characters long');
    }

    if (prompt.trim().length > 1000) {
      throw new Error('Prompt must be less than 1000 characters');
    }

    // Validate dimensions
    const validDimensions = [512, 1024, 1536];
    if (!validDimensions.includes(width) || !validDimensions.includes(height)) {
      throw new Error('Image dimensions must be 512, 1024, or 1536 pixels');
    }

    try {
      const response = await this.callGenerateContentAPI(prompt, width, height, userId);

      return {
        imageUrl: response.imageUrl,
        prompt,
        width,
        height,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Image generation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Call the Gemini generateContent REST API and request an IMAGE-modality
   * response. https://ai.google.dev/gemini-api/docs/image-generation
   */
  private async callGenerateContentAPI(
    prompt: string,
    width: number,
    height: number,
    userId?: string
  ): Promise<{ imageUrl: string }> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: nearestAspectRatio(width, height) },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: { inlineData?: { data?: string } }) => part.inlineData?.data);

    if (!imagePart) {
      throw new Error('No image generated in API response');
    }

    const imageUrl = await this.uploadImageToStorage(
      imagePart.inlineData.data,
      imagePart.inlineData.mimeType || 'image/png',
      userId
    );

    return { imageUrl };
  }

  /**
   * Persist the model's base64 output and return a URL to store on the row.
   * Uploads to Vercel Blob when configured; lib/storage.ts degrades to a data
   * URI (with a warning) when it is not, so local dev still works.
   */
  private async uploadImageToStorage(base64Data: string, mimeType: string, userId?: string): Promise<string> {
    const extension = mimeType.split('/')[1] || 'png';
    const { url } = await uploadMedia(base64Data, {
      kind: 'image',
      userId: userId || 'anonymous',
      extension,
      contentType: mimeType,
      base64: true,
    });
    return url;
  }

  /**
   * Get remaining quota for image generation
   * Useful for rate limiting and quota management
   */
  async getQuotaInfo(): Promise<{ dailyLimit: number; usedToday: number; remaining: number }> {
    // Placeholder - implement if Google provides quota API
    return {
      dailyLimit: 1000,
      usedToday: 0,
      remaining: 1000,
    };
  }
}

// Export singleton instance
export const geminiImageService = new GeminiImageService();
