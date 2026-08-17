/**
 * Research Phase — gathers facts + citations via web.search, then asks the
 * model to structure a title, subtitle, and section outline from them.
 * Degrades gracefully (outline from general knowledge, no citations) when
 * web.search isn't configured rather than failing the whole pipeline.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, Citation, DocumentOutlineItem } from '../types';
import { callModel, callTool, extractJson, CHEAP_MODEL } from '../phase-utils';
import { buildSearchQueriesPrompt, buildOutlinePrompt } from '../prompts';

const MAX_QUERIES = 4;
const MAX_CITATIONS = 8;

export async function runResearchPhase(
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const traces: ExecutionTrace[] = [];
  let step = startStepNumber;

  // 1. Ask the model for a handful of focused search queries.
  const queriesCall = await callModel(context, {
    stepNumber: step++,
    action: 'research.planQueries',
    prompt: buildSearchQueriesPrompt(spec.goal),
    model: CHEAP_MODEL,
    maxTokens: 300,
  });
  traces.push(queriesCall.trace);

  const queries = (extractJson<string[]>(queriesCall.content) || []).slice(0, MAX_QUERIES);

  // 2. Run each query through web.search, collecting citations. Missing
  // TAVILY_API_KEY or a search failure degrades to "no citations" rather
  // than aborting — the outline step below handles that case explicitly.
  const citations: Citation[] = [];
  const snippets: { title: string; url: string; snippet: string }[] = [];
  const accessedDate = new Date().toISOString().slice(0, 10);

  for (const query of queries) {
    const searchCall = await callTool(context, {
      stepNumber: step++,
      action: 'research.search',
      toolName: 'web.search',
      params: { query, maxResults: 3 },
    });
    traces.push(searchCall.trace);

    if (!searchCall.result.success) continue;

    const results = (searchCall.result.data?.results || []) as { title: string; url: string; snippet: string }[];
    for (const r of results) {
      if (citations.length >= MAX_CITATIONS) break;
      const id = `c${citations.length + 1}`;
      citations.push({ id, title: r.title, url: r.url, accessedDate, sourceTool: 'web.search' });
      snippets.push(r);
    }
  }

  // 3. Structure a title, subtitle, and outline from the goal + research.
  const outlineCall = await callModel(context, {
    stepNumber: step++,
    action: 'research.outline',
    prompt: buildOutlinePrompt(spec.goal, snippets),
    maxTokens: 1200,
  });
  traces.push(outlineCall.trace);

  const parsed = extractJson<{ title?: string; subtitle?: string; outline?: any[] }>(outlineCall.content);
  const outline: DocumentOutlineItem[] = (parsed?.outline || []).map((item, i) => ({
    id: `o${i + 1}`,
    heading: item.heading || `Section ${i + 1}`,
    level: (item.level === 2 || item.level === 3 ? item.level : 1) as 1 | 2 | 3,
    intent: item.intent || '',
    needsChart: Boolean(item.needsChart),
    needsTable: Boolean(item.needsTable),
    needsImage: Boolean(item.needsImage),
  }));

  return {
    spec: {
      ...spec,
      title: parsed?.title || spec.goal.slice(0, 100),
      subtitle: parsed?.subtitle || undefined,
      citations,
      outline: outline.length ? outline : [{ id: 'o1', heading: 'Overview', level: 1, intent: spec.goal }],
    },
    traces,
  };
}
