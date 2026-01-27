/**
 * AI Tool - Use AI models for various tasks
 */

import { AgentTool, AgentContext, ToolResult } from '../types';

/**
 * Generate text using AI
 */
export class AiChatTool implements AgentTool {
  name = 'ai.chat';
  description = 'Generate text using AI models (for summarization, analysis, writing)';
  category = 'utility' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.prompt || typeof params.prompt !== 'string') {
      return { valid: false, error: 'prompt parameter required (string)' };
    }
    return { valid: true };
  }

  async execute(
    params: {
      prompt: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const model = params.model || 'claude-haiku-4-5-20250529'; // Use cheap model by default
      const maxTokens = params.maxTokens || 1024;
      const temperature = params.temperature || 0.7;

      const response = await context.aiRouter.chat(model, {
        messages: [{
          role: 'user',
          content: params.prompt,
        }],
        maxTokens,
        temperature,
      });

      const credits = context.aiRouter.estimateCredits(model, response.usage.totalTokens);

      return {
        success: true,
        data: {
          content: response.content,
          model: response.model,
          provider: response.provider,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits,
          tokens: response.usage.totalTokens,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 100,
          tokens: 0,
        },
      };
    }
  }

  estimateCost(params: any): number {
    // Estimate based on prompt length
    const estimatedTokens = Math.ceil((params.prompt?.length || 0) / 4) + 1000;
    return Math.ceil(estimatedTokens / 1000) * 3; // Haiku pricing
  }
}

/**
 * Summarize text
 */
export class AiSummarizeTool implements AgentTool {
  name = 'ai.summarize';
  description = 'Summarize long text into key points';
  category = 'utility' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.text || typeof params.text !== 'string') {
      return { valid: false, error: 'text parameter required (string)' };
    }
    return { valid: true };
  }

  async execute(
    params: {
      text: string;
      maxLength?: number;
      style?: 'bullet' | 'paragraph';
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const chatTool = new AiChatTool();

    const style = params.style || 'bullet';
    const maxLength = params.maxLength || 200;

    const prompt = `Summarize the following text in ${style === 'bullet' ? 'bullet points' : 'a concise paragraph'} (max ${maxLength} words):

${params.text}

Summary:`;

    return chatTool.execute({ prompt }, context);
  }

  estimateCost(params: any): number {
    const textLength = params.text?.length || 0;
    const estimatedTokens = Math.ceil(textLength / 4) + 500;
    return Math.ceil(estimatedTokens / 1000) * 3;
  }
}

/**
 * Extract structured data from text
 */
export class AiExtractTool implements AgentTool {
  name = 'ai.extract';
  description = 'Extract structured data from unstructured text';
  category = 'utility' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.text || typeof params.text !== 'string') {
      return { valid: false, error: 'text parameter required (string)' };
    }

    if (!params.schema || typeof params.schema !== 'object') {
      return { valid: false, error: 'schema parameter required (object)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      text: string;
      schema: Record<string, string>; // Field name -> description
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const chatTool = new AiChatTool();

    const schemaDesc = Object.entries(params.schema)
      .map(([field, desc]) => `- ${field}: ${desc}`)
      .join('\n');

    const prompt = `Extract the following information from the text and return it as JSON:

Fields to extract:
${schemaDesc}

Text:
${params.text}

Return only valid JSON with the extracted data. If a field cannot be found, use null.`;

    const result = await chatTool.execute({ prompt }, context);

    if (result.success) {
      try {
        // Parse JSON from response
        const jsonMatch = result.data.content.match(/```json\n([\s\S]*?)\n```/) ||
                         result.data.content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          result.data = {
            ...result.data,
            extracted,
          };
        }
      } catch (error) {
        // If parsing fails, return raw content
      }
    }

    return result;
  }

  estimateCost(params: any): number {
    const textLength = params.text?.length || 0;
    const estimatedTokens = Math.ceil(textLength / 4) + 1000;
    return Math.ceil(estimatedTokens / 1000) * 3;
  }
}
