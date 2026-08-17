/**
 * Web Search Tool - Look up current information via Tavily
 */

import { AgentTool, AgentContext, ToolResult } from '../types';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Search the web for current information
 */
export class WebSearchTool implements AgentTool {
  name = 'web.search';
  description = 'Search the web for current information. Returns relevant results with title, URL, and a short snippet.';
  category = 'utility' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query' },
      maxResults: { type: 'number', description: 'Maximum results to return (default 5, max 10)' },
    },
    required: ['query'],
  };

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.query || typeof params.query !== 'string') {
      return { valid: false, error: 'query parameter required (string)' };
    }
    if (
      params.maxResults !== undefined &&
      (typeof params.maxResults !== 'number' || params.maxResults < 1 || params.maxResults > 10)
    ) {
      return { valid: false, error: 'maxResults must be a number between 1 and 10' };
    }
    return { valid: true };
  }

  estimateCost(): number {
    return 5;
  }

  async execute(
    params: { query: string; maxResults?: number },
    _context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'Web search is not configured (missing TAVILY_API_KEY).',
        metadata: { duration: Date.now() - startTime, credits: 0 },
      };
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: params.query,
          max_results: Math.min(params.maxResults ?? 5, 10),
        }),
      });

      if (!res.ok) {
        const errorBody = (await res.text()).slice(0, 300);
        return {
          success: false,
          error: `Tavily search failed (${res.status}): ${errorBody}`,
          metadata: { duration: Date.now() - startTime, credits: 0 },
        };
      }

      const data = await res.json();
      const results = ((data.results ?? []) as TavilyResult[]).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));

      return {
        success: true,
        data: { results },
        metadata: { duration: Date.now() - startTime, credits: 5 },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { duration: Date.now() - startTime, credits: 0 },
      };
    }
  }
}
