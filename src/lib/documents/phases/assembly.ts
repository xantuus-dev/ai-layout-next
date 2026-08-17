/**
 * Assembly Phase — calls the format-specific rendering tools
 * (document.createPdf/Docx/Deck/Xlsx) for every requested output format,
 * using the fully-populated DocumentSpec as the single source of content.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, GeneratedOutput, DocumentFormat } from '../types';
import { callModel, callTool, extractJson } from '../phase-utils';
import { buildSlideBulletsPrompt } from '../prompts';

async function buildSlides(spec: DocumentSpec, context: AgentContext, startStep: number) {
  const traces: ExecutionTrace[] = [];
  let step = startStep;
  const slides: { title: string; bullets: string[]; chartId?: string; speakerNotes?: string }[] = [];

  for (const section of spec.sections) {
    const bulletsCall = await callModel(context, {
      stepNumber: step++,
      action: 'assembly.slideBullets',
      prompt: buildSlideBulletsPrompt(section),
      maxTokens: 300,
    });
    traces.push(bulletsCall.trace);

    const bullets = extractJson<string[]>(bulletsCall.content) || [section.content.slice(0, 120)];
    const citedIds = Array.from(section.content.matchAll(/\[(c\d+)\]/g)).map((m) => m[1]);
    const sources = spec.citations.filter((c) => citedIds.includes(c.id));

    slides.push({
      title: section.heading,
      bullets: bullets.slice(0, 6),
      chartId: section.chartIds?.[0],
      speakerNotes: sources.length ? `Sources: ${sources.map((s) => s.title).join('; ')}` : undefined,
    });
  }

  return { slides, traces, nextStep: step };
}

export async function runAssemblyPhase(
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const traces: ExecutionTrace[] = [];
  let step = startStepNumber;
  const outputs: GeneratedOutput[] = [];
  const title = spec.title || spec.goal.slice(0, 100);

  const buildFor = async (format: DocumentFormat) => {
    if (format === 'pdf' || format === 'docx') {
      const toolName = format === 'pdf' ? 'document.createPdf' : 'document.createDocx';
      const call = await callTool(context, {
        stepNumber: step++,
        action: `assembly.create${format}`,
        toolName,
        params: {
          title,
          subtitle: spec.subtitle,
          sections: spec.sections,
          charts: spec.charts,
          tables: spec.tables,
          images: spec.images,
          citations: spec.citations,
          includeToc: format === 'docx' && spec.sections.length > 3,
          theme: spec.theme,
        },
      });
      traces.push(call.trace);
      return call;
    }

    if (format === 'pptx') {
      const { slides, traces: slideTraces, nextStep } = await buildSlides(spec, context, step);
      step = nextStep;
      traces.push(...slideTraces);

      const call = await callTool(context, {
        stepNumber: step++,
        action: 'assembly.createPptx',
        toolName: 'document.createDeck',
        params: { title, subtitle: spec.subtitle, slides, charts: spec.charts },
      });
      traces.push(call.trace);
      return call;
    }

    // xlsx: one sheet per generated table; attach the first chart to the
    // first sheet, if any, so the workbook isn't purely tabular when charts exist.
    const sheets = spec.tables.map((t, i) => ({
      name: t.title.slice(0, 31) || `Sheet ${i + 1}`,
      columns: t.columns,
      rows: t.rows,
      chartId: i === 0 ? spec.charts[0]?.id : undefined,
    }));

    if (!sheets.length) {
      // No tables were generated — fall back to a single sheet listing section headings,
      // so requesting xlsx never produces an empty/failed workbook.
      sheets.push({
        name: 'Overview',
        columns: ['Section'],
        rows: spec.sections.map((s) => [s.heading]),
        chartId: spec.charts[0]?.id,
      });
    }

    const call = await callTool(context, {
      stepNumber: step++,
      action: 'assembly.createXlsx',
      toolName: 'document.createXlsx',
      params: { title, sheets, charts: spec.charts },
    });
    traces.push(call.trace);
    return call;
  };

  for (const format of spec.requestedFormats) {
    const call = await buildFor(format);
    if (call.result.success) {
      outputs.push({
        format,
        url: call.result.data.url,
        filename: call.result.data.filename,
        bytes: call.result.data.bytes,
        persisted: call.result.data.persisted,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return { spec: { ...spec, outputs }, traces };
}
