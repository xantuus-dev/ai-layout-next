/**
 * FactExtractor - Phase 2
 *
 * Uses LLM to extract structured facts from conversations.
 * Identifies preferences, decisions, facts, context, goals, and skills.
 *
 * Based on OpenClaw's memory consolidation approach:
 * - Extract durable information worth persisting
 * - Categorize by type for better retrieval
 * - Assign confidence scores
 * - Detect duplicates and merge
 *
 * @author Xantuus AI Team
 * @date 2026-02-17
 */

import OpenAI from 'openai';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type FactType = 'preference' | 'fact' | 'decision' | 'context' | 'goal' | 'skill';

export interface ExtractedFact {
  type: FactType;
  content: string;
  confidence: number;
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  summary?: string;
  tokenCount: number;
}

export interface ExtractionOptions {
  model?: string;
  temperature?: number;
  maxFacts?: number;
  minConfidence?: number;
}

// ============================================================================
// FactExtractor Class
// ============================================================================

export class FactExtractor {
  private openai: OpenAI;
  private defaultModel: string;

  constructor(openai: OpenAI, defaultModel: string = 'gpt-4o-mini') {
    this.openai = openai;
    this.defaultModel = defaultModel;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Extract facts from conversation text
   *
   * @param conversationText - Full conversation text
   * @param options - Extraction options
   */
  async extractFacts(
    conversationText: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.3;
    const maxFacts = options.maxFacts ?? 20;
    const minConfidence = options.minConfidence ?? 0.6;

    const prompt = this.buildExtractionPrompt(conversationText, maxFacts);

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return { facts: [], tokenCount: 0 };
      }

      const parsed = JSON.parse(content);
      const facts: ExtractedFact[] = (parsed.facts || [])
        .filter((fact: any) => fact.confidence >= minConfidence)
        .map((fact: any) => ({
          type: this.normalizeFactType(fact.type),
          content: fact.content,
          confidence: Math.min(1.0, Math.max(0.0, fact.confidence)),
          reasoning: fact.reasoning,
          metadata: fact.metadata || {},
        }));

      return {
        facts,
        summary: parsed.summary,
        tokenCount: response.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error('[FactExtractor] Extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract facts from multiple conversation chunks (streaming)
   *
   * @param chunks - Array of conversation chunks
   * @param options - Extraction options
   */
  async extractFactsFromChunks(
    chunks: string[],
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const allFacts: ExtractedFact[] = [];
    let totalTokens = 0;

    for (const chunk of chunks) {
      try {
        const result = await this.extractFacts(chunk, options);
        allFacts.push(...result.facts);
        totalTokens += result.tokenCount;

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('[FactExtractor] Error processing chunk:', error);
        // Continue with other chunks
      }
    }

    // Deduplicate facts
    const deduplicatedFacts = this.deduplicateFacts(allFacts);

    return {
      facts: deduplicatedFacts,
      tokenCount: totalTokens,
    };
  }

  /**
   * Validate a fact's content and structure
   */
  validateFact(fact: ExtractedFact): boolean {
    // Must have content
    if (!fact.content || fact.content.trim().length === 0) {
      return false;
    }

    // Content should be meaningful (more than a few words)
    if (fact.content.split(' ').length < 3) {
      return false;
    }

    // Valid fact type
    const validTypes: FactType[] = ['preference', 'fact', 'decision', 'context', 'goal', 'skill'];
    if (!validTypes.includes(fact.type)) {
      return false;
    }

    // Confidence in valid range
    if (fact.confidence < 0 || fact.confidence > 1) {
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Get system prompt for fact extraction
   */
  private getSystemPrompt(): string {
    return `You are a memory extraction expert. Your task is to extract important, durable facts from conversations that are worth remembering long-term.

Focus on extracting:

1. **Preferences**: User likes, dislikes, preferred ways of working
   Example: "User prefers TypeScript over JavaScript"

2. **Facts**: Objective information about the user, their work, or environment
   Example: "User is a cloud architect building a mobile app called Xantuus"

3. **Decisions**: Important choices or determinations made
   Example: "Decided to use PostgreSQL with pgvector for memory system"

4. **Context**: Background information that provides understanding
   Example: "Working on Phase 2 of memory system implementation"

5. **Goals**: Objectives, aims, or intentions
   Example: "Goal: Launch Xantuus AI mobile app to production by Q2 2026"

6. **Skills**: Capabilities, expertise, or proficiencies
   Example: "Experienced with React Native, Node.js, and PostgreSQL"

Guidelines:
- Extract only durable, lasting information (not transient conversation flow)
- Be concise but complete - each fact should be self-contained
- Assign confidence scores (0.0-1.0) based on how certain you are
- Avoid extracting temporary context or small talk
- Combine related information into single facts when appropriate
- Extract 5-20 facts per conversation (focus on quality over quantity)

Return your response as valid JSON with this structure:
{
  "facts": [
    {
      "type": "preference" | "fact" | "decision" | "context" | "goal" | "skill",
      "content": "The extracted fact as a complete sentence",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of why this is important"
    }
  ],
  "summary": "Optional 1-2 sentence summary of the conversation"
}`;
  }

  /**
   * Build extraction prompt for conversation text
   */
  private buildExtractionPrompt(conversationText: string, maxFacts: number): string {
    return `Extract important facts from this conversation. Focus on durable information worth remembering.

Extract up to ${maxFacts} facts.

Conversation:
${conversationText}

Respond with valid JSON following the schema described in the system prompt.`;
  }

  /**
   * Normalize fact type to valid enum value
   */
  private normalizeFactType(type: string): FactType {
    const normalized = type.toLowerCase().trim();

    const typeMap: Record<string, FactType> = {
      preference: 'preference',
      pref: 'preference',
      like: 'preference',
      dislike: 'preference',

      fact: 'fact',
      information: 'fact',
      info: 'fact',

      decision: 'decision',
      choice: 'decision',
      determination: 'decision',

      context: 'context',
      background: 'context',
      situation: 'context',

      goal: 'goal',
      objective: 'goal',
      aim: 'goal',
      target: 'goal',

      skill: 'skill',
      expertise: 'skill',
      capability: 'skill',
      proficiency: 'skill',
    };

    return typeMap[normalized] || 'fact';
  }

  /**
   * Deduplicate facts using content similarity
   */
  private deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
    const deduplicated: ExtractedFact[] = [];

    for (const fact of facts) {
      // Check if similar fact already exists
      const similar = deduplicated.find(existing =>
        this.areSimilarFacts(existing, fact)
      );

      if (similar) {
        // Keep the one with higher confidence
        if (fact.confidence > similar.confidence) {
          const index = deduplicated.indexOf(similar);
          deduplicated[index] = fact;
        }
      } else {
        deduplicated.push(fact);
      }
    }

    return deduplicated;
  }

  /**
   * Check if two facts are similar (simple text matching)
   */
  private areSimilarFacts(fact1: ExtractedFact, fact2: ExtractedFact): boolean {
    // Same type
    if (fact1.type !== fact2.type) {
      return false;
    }

    // Normalize content
    const content1 = fact1.content.toLowerCase().trim();
    const content2 = fact2.content.toLowerCase().trim();

    // Exact match
    if (content1 === content2) {
      return true;
    }

    // High word overlap (> 70%)
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;

    return similarity > 0.7;
  }
}
