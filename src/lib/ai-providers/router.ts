/**
 * AI Router - Multi-Provider Orchestration
 * Routes requests to appropriate AI providers and manages fallbacks
 */

import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import { AIProvider, AIModel, ChatParams, ChatResponse, AIRouterOptions } from './types';

class AIRouter {
  private providers: Map<string, AIProvider> = new Map();
  private allModels: AIModel[] = [];
  private modelToProvider: Map<string, string> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize all providers
    const anthropic = new AnthropicProvider();
    const openai = new OpenAIProvider();
    const google = new GoogleProvider();

    // Register configured providers
    if (anthropic.isConfigured()) {
      this.registerProvider(anthropic);
      console.log('✅ Anthropic provider registered');
    } else {
      console.warn('⚠️  Anthropic provider not configured (missing ANTHROPIC_API_KEY)');
    }

    if (openai.isConfigured()) {
      this.registerProvider(openai);
      console.log('✅ OpenAI provider registered');
    } else {
      console.warn('⚠️  OpenAI provider not configured (missing OPENAI_API_KEY)');
    }

    if (google.isConfigured()) {
      this.registerProvider(google);
      console.log('✅ Google provider registered');
    } else {
      console.warn('⚠️  Google provider not configured (missing GOOGLE_AI_API_KEY)');
    }

    console.log(`🤖 AI Router initialized with ${this.providers.size} provider(s) and ${this.allModels.length} model(s)`);
  }

  private registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider);

    // Add models from this provider
    for (const model of provider.models) {
      this.allModels.push(model);
      this.modelToProvider.set(model.id, provider.id);
    }
  }

  /**
   * Get all available models across all providers
   */
  getAllModels(): AIModel[] {
    return this.allModels;
  }

  /**
   * Get models grouped by provider
   */
  getModelsByProvider(): Record<string, AIModel[]> {
    const grouped: Record<string, AIModel[]> = {};

    for (const model of this.allModels) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    }

    return grouped;
  }

  /**
   * Get a specific provider by ID
   */
  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get the provider for a specific model
   */
  getProviderForModel(modelId: string): AIProvider | null {
    const providerId = this.modelToProvider.get(modelId);
    if (!providerId) {
      return null;
    }
    return this.providers.get(providerId) || null;
  }

  /**
   * Get model metadata
   */
  getModel(modelId: string): AIModel | undefined {
    return this.allModels.find(m => m.id === modelId);
  }

  /**
   * Main chat interface - routes to appropriate provider
   */
  async chat(
    modelId: string,
    params: Omit<ChatParams, 'model'>,
    options?: AIRouterOptions
  ): Promise<ChatResponse> {
    const provider = this.getProviderForModel(modelId);

    if (!provider) {
      throw new Error(
        `No provider found for model: ${modelId}. Available models: ${this.allModels.map(m => m.id).join(', ')}`
      );
    }

    try {
      const response = await provider.chat({
        ...params,
        model: modelId,
      });

      return response;
    } catch (error) {
      // Handle fallback logic if enabled
      if (options?.fallbackEnabled) {
        console.error(`Error with ${provider.name}, attempting fallback...`);
        // TODO: Implement intelligent fallback to similar models
        throw error;
      }

      throw error;
    }
  }

  /**
   * Estimate credits for a model and token count
   */
  estimateCredits(modelId: string, tokens: number): number {
    const provider = this.getProviderForModel(modelId);

    if (!provider) {
      // Default to 3 credits per 1K tokens (Sonnet pricing)
      return Math.max(1, Math.ceil((tokens / 1000) * 3));
    }

    return provider.estimateCredits(tokens, modelId);
  }

  /**
   * Get cheapest model for a given capability
   */
  getCheapestModel(capability?: string): AIModel | undefined {
    let models = this.allModels;

    if (capability) {
      models = models.filter(m => m.capabilities.includes(capability));
    }

    if (models.length === 0) {
      return undefined;
    }

    return models.reduce((cheapest, current) =>
      current.creditsPerThousandTokens < cheapest.creditsPerThousandTokens
        ? current
        : cheapest
    );
  }

  /**
   * Get provider status (for admin/debugging)
   */
  getStatus() {
    return {
      providers: Array.from(this.providers.values()).map(p => ({
        id: p.id,
        name: p.name,
        configured: p.isConfigured(),
        modelCount: p.models.length,
      })),
      totalModels: this.allModels.length,
    };
  }
}

// Export singleton instance
export const aiRouter = new AIRouter();

// Export for testing/admin purposes
export { AIRouter };
