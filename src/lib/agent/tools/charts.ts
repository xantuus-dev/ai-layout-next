/**
 * Chart Rendering Tool
 *
 * Renders a Chart.js chart to a PNG via headless Chromium and uploads it,
 * so agents get a stable image URL to embed into PDFs, DOCX, and slides.
 * Shares the Puppeteer instance in ../rendering/puppeteer-pool.ts with the
 * HTML-to-PDF renderer rather than launching its own browser.
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { uploadMedia } from '@/lib/storage';
import { withRenderPage } from '../rendering/puppeteer-pool';
import { buildChartHtml, ChartRenderSpec } from '../rendering/chart-template';

const CHART_CREDITS = 2;
const MAX_SERIES = 12;
const MAX_LABELS = 100;
const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'scatter'];

function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || fallback)
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || fallback;
}

export class ChartRenderTool implements AgentTool {
  name = 'chart.render';
  description =
    'Render a chart (bar, line, pie, doughnut, or scatter) as a PNG image and return a ' +
    'download URL. Use this to produce chart images for embedding into documents, ' +
    'presentations, or spreadsheets. Provide one or more data series sharing the same labels.';
  category = 'document' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      type: { type: 'string', description: 'Chart type', enum: CHART_TYPES },
      title: { type: 'string', description: 'Chart title, shown above the plot' },
      labels: { type: 'array', description: 'Category labels shared across all series', items: { type: 'string' } },
      series: {
        type: 'array',
        description: 'One or more named data series, each with a numeric value per label',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            data: { type: 'array', items: { type: 'number' } },
          },
        },
      },
      width: { type: 'number', description: 'Image width in pixels (default 800)' },
      height: { type: 'number', description: 'Image height in pixels (default 480)' },
      theme: { type: 'string', description: 'Named theme preset', enum: ['default', 'investor', 'minimal'] },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['type', 'title', 'labels', 'series'],
  };

  validate(params: any): { valid: boolean; error?: string } {
    if (!params?.type || !CHART_TYPES.includes(params.type)) {
      return { valid: false, error: `type must be one of: ${CHART_TYPES.join(', ')}` };
    }
    if (!params?.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }
    if (!Array.isArray(params.labels) || params.labels.length === 0) {
      return { valid: false, error: 'labels parameter required (non-empty array)' };
    }
    if (params.labels.length > MAX_LABELS) {
      return { valid: false, error: `labels limited to ${MAX_LABELS} entries` };
    }
    if (!Array.isArray(params.series) || params.series.length === 0) {
      return { valid: false, error: 'series parameter required (non-empty array)' };
    }
    if (params.series.length > MAX_SERIES) {
      return { valid: false, error: `series limited to ${MAX_SERIES} entries` };
    }
    for (const [i, s] of params.series.entries()) {
      if (!s?.name || typeof s.name !== 'string') {
        return { valid: false, error: `series[${i}].name required (string)` };
      }
      if (!Array.isArray(s.data) || s.data.length !== params.labels.length) {
        return { valid: false, error: `series[${i}].data must be a numeric array matching labels.length` };
      }
    }
    return { valid: true };
  }

  estimateCost(): number {
    return CHART_CREDITS;
  }

  async execute(
    params: ChartRenderSpec & { filename?: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const width = Math.min(Math.max(params.width || 800, 200), 2000);
      const height = Math.min(Math.max(params.height || 480, 200), 1400);
      const html = buildChartHtml({ ...params, width, height });

      const buffer = await withRenderPage(async (page) => {
        await page.setViewport({ width, height });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForFunction('window.__chartReady === true', { timeout: 10000 });
        const canvas = await page.$('#chart');
        if (!canvas) throw new Error('chart canvas not found after render');
        const shot = await canvas.screenshot({ type: 'png' });
        return Buffer.from(shot);
      });

      const filename = safeFilename(params.filename || params.title, 'chart') + '.png';
      const upload = await uploadMedia(buffer, {
        kind: 'image',
        userId: context.userId,
        extension: 'png',
        contentType: 'image/png',
      });

      return {
        success: true,
        data: { url: upload.url, filename, width, height, bytes: upload.bytes, persisted: upload.persisted },
        metadata: { duration: Date.now() - startTime, credits: CHART_CREDITS },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chart rendering failed',
        metadata: { duration: Date.now() - startTime, credits: 0 },
      };
    }
  }
}
