/**
 * Data/Chart Phase — for every outline item flagged needsChart/needsTable,
 * asks the model for a chart/table spec grounded in the drafted section
 * content, renders charts via chart.render, and links results back into the
 * matching section's chartIds/tableIds.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, ChartSpec, TableSpec } from '../types';
import { callModel, callTool, extractJson } from '../phase-utils';
import { buildChartSpecPrompt, buildTableSpecPrompt } from '../prompts';

const CHART_TYPES = new Set(['bar', 'line', 'pie', 'doughnut', 'scatter']);

/** Marks a numeric-looking "+X%" / "-X%" trailing column as positive/negative for visual emphasis. */
function inferHighlightCells(rows: (string | number)[][]): TableSpec['highlightCells'] {
  if (!rows.length) return undefined;
  const lastCol = rows[0].length - 1;
  const cells: NonNullable<TableSpec['highlightCells']> = [];
  rows.forEach((row, r) => {
    const val = String(row[lastCol]);
    if (/^\+/.test(val)) cells.push({ row: r, col: lastCol, style: 'positive' });
    else if (/^-/.test(val)) cells.push({ row: r, col: lastCol, style: 'negative' });
  });
  return cells.length ? cells : undefined;
}

export async function runDataChartPhase(
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const traces: ExecutionTrace[] = [];
  let step = startStepNumber;
  const charts: ChartSpec[] = [];
  const tables: TableSpec[] = [];
  const sections = spec.sections.map((s) => ({ ...s, chartIds: [...(s.chartIds || [])], tableIds: [...(s.tableIds || [])] }));

  for (const item of spec.outline) {
    const section = sections.find((s) => s.id === item.id);
    if (!section) continue;

    if (item.needsChart) {
      const specCall = await callModel(context, {
        stepNumber: step++,
        action: 'dataChart.planChart',
        prompt: buildChartSpecPrompt(spec.goal, item, section.content),
        maxTokens: 600,
      });
      traces.push(specCall.trace);

      const parsed = extractJson<{ type: string; title: string; labels: string[]; series: { name: string; data: number[] }[] }>(
        specCall.content
      );

      if (parsed?.labels?.length && parsed?.series?.length) {
        const chartId = `chart${charts.length + 1}`;
        const chartType = CHART_TYPES.has(parsed.type) ? parsed.type : 'bar';

        const renderCall = await callTool(context, {
          stepNumber: step++,
          action: 'dataChart.render',
          toolName: 'chart.render',
          params: {
            type: chartType,
            title: parsed.title || item.heading,
            labels: parsed.labels,
            series: parsed.series,
            theme: spec.theme,
          },
        });
        traces.push(renderCall.trace);

        if (renderCall.result.success) {
          charts.push({
            id: chartId,
            type: chartType as ChartSpec['type'],
            title: parsed.title || item.heading,
            labels: parsed.labels,
            series: parsed.series,
            imageUrl: renderCall.result.data.url,
          });
          section.chartIds!.push(chartId);
        }
      }
    }

    if (item.needsTable) {
      const specCall = await callModel(context, {
        stepNumber: step++,
        action: 'dataChart.planTable',
        prompt: buildTableSpecPrompt(spec.goal, item, section.content),
        maxTokens: 600,
      });
      traces.push(specCall.trace);

      const parsed = extractJson<{ title: string; columns: string[]; rows: (string | number)[][] }>(specCall.content);

      if (parsed?.columns?.length && parsed?.rows?.length) {
        const tableId = `table${tables.length + 1}`;
        tables.push({
          id: tableId,
          title: parsed.title || item.heading,
          columns: parsed.columns,
          rows: parsed.rows,
          highlightCells: inferHighlightCells(parsed.rows),
        });
        section.tableIds!.push(tableId);
      }
    }
  }

  return { spec: { ...spec, sections, charts, tables }, traces };
}
