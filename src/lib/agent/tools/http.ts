/**
 * HTTP Tool - Make HTTP requests to external APIs
 */

import { AgentTool, AgentContext, ToolResult } from '../types';

/**
 * Make HTTP GET request
 */
export class HttpGetTool implements AgentTool {
  name = 'http.get';
  description = 'Make an HTTP GET request to an API';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.url || typeof params.url !== 'string') {
      return { valid: false, error: 'url parameter required (string)' };
    }

    try {
      new URL(params.url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  async execute(
    params: {
      url: string;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Build URL with query params
      const url = new URL(params.url);
      if (params.query) {
        Object.entries(params.query).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: params.headers || {},
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      const data = isJson ? await response.json() : await response.text();

      return {
        success: response.ok,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        },
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        metadata: {
          duration: Date.now() - startTime,
          credits: 5,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 5,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 5;
  }
}

/**
 * Make HTTP POST request
 */
export class HttpPostTool implements AgentTool {
  name = 'http.post';
  description = 'Make an HTTP POST request to an API';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.url || typeof params.url !== 'string') {
      return { valid: false, error: 'url parameter required (string)' };
    }

    try {
      new URL(params.url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  async execute(
    params: {
      url: string;
      body?: any;
      headers?: Record<string, string>;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const headers = params.headers || {};

      // Default to JSON if body is object
      if (typeof params.body === 'object' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const bodyContent = typeof params.body === 'string'
        ? params.body
        : JSON.stringify(params.body);

      const response = await fetch(params.url, {
        method: 'POST',
        headers,
        body: bodyContent,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      const data = isJson ? await response.json() : await response.text();

      return {
        success: response.ok,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        },
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        metadata: {
          duration: Date.now() - startTime,
          credits: 5,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 5,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 5;
  }
}
