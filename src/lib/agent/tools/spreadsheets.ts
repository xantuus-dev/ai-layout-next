/**
 * Spreadsheet Tool - Produce Excel (.xlsx) workbooks from agent output
 *
 * Mirrors the conventions in ./documents.ts: dynamic import of the heavy
 * renderer, uploadMedia() for delivery, credits tracked separately from
 * provider spend since this is pure local compute (plus, optionally,
 * fetching already-rendered chart images).
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { uploadMedia } from '@/lib/storage';
import type { ChartSpec } from '@/lib/documents/types';

const XLSX_CREDITS = 3;
const MAX_SHEETS = 20;
const MAX_ROWS_PER_SHEET = 5000;

function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || fallback)
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || fallback;
}

interface SheetInput {
  name: string;
  columns: string[];
  rows: (string | number)[][];
  /** Chart id (see ChartSpec.imageUrl) to embed below the table on this sheet. */
  chartId?: string;
}

export class DocumentCreateXlsxTool implements AgentTool {
  name = 'document.createXlsx';
  description =
    'Create an Excel (.xlsx) workbook and return a download URL. Takes one or more sheets, ' +
    'each with a title, column headers, and data rows. Optionally embeds a chart image ' +
    '(from chart.render, via "charts" + sheets[].chartId) below the table on a sheet. Use ' +
    'for structured data, comparison tables, and financial summaries.';
  category = 'document' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Workbook title (used for the default filename)' },
      sheets: {
        type: 'array',
        description: 'Worksheets (max 20), each with a name, column headers, and rows',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            columns: { type: 'array', items: { type: 'string' } },
            rows: { type: 'array', items: { type: 'array' } },
            chartId: { type: 'string', description: 'Chart to embed below the table on this sheet' },
          },
          required: ['name', 'columns', 'rows'],
        },
      },
      charts: { type: 'array', description: 'Chart specs (from chart.render) referenced by sheets via chartId', items: { type: 'object' } },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title', 'sheets'],
  };

  validate(params: any): { valid: boolean; error?: string } {
    if (!params?.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }
    if (!Array.isArray(params.sheets) || params.sheets.length === 0) {
      return { valid: false, error: 'sheets parameter required (non-empty array)' };
    }
    if (params.sheets.length > MAX_SHEETS) {
      return { valid: false, error: `sheets limited to ${MAX_SHEETS} entries` };
    }
    for (const [i, sheet] of params.sheets.entries()) {
      if (!sheet?.name || typeof sheet.name !== 'string') {
        return { valid: false, error: `sheets[${i}].name required (string)` };
      }
      if (!Array.isArray(sheet.columns) || sheet.columns.length === 0) {
        return { valid: false, error: `sheets[${i}].columns required (non-empty array)` };
      }
      if (!Array.isArray(sheet.rows)) {
        return { valid: false, error: `sheets[${i}].rows must be an array` };
      }
      if (sheet.rows.length > MAX_ROWS_PER_SHEET) {
        return { valid: false, error: `sheets[${i}].rows limited to ${MAX_ROWS_PER_SHEET} entries` };
      }
    }
    return { valid: true };
  }

  estimateCost(): number {
    return XLSX_CREDITS;
  }

  async execute(
    params: { title: string; sheets: SheetInput[]; charts?: ChartSpec[]; filename?: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Xantuus AI';
      workbook.created = new Date();

      const ACCENT = 'FF0D9488';
      const charts = params.charts || [];

      for (const sheetInput of params.sheets) {
        const sheet = workbook.addWorksheet(sheetInput.name.slice(0, 31));

        sheet.columns = sheetInput.columns.map((col) => ({ header: col, key: col, width: Math.max(col.length + 4, 14) }));
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
          cell.alignment = { vertical: 'middle' };
        });

        for (const row of sheetInput.rows) {
          sheet.addRow(row);
        }

        // Zebra striping for readability on wide tables.
        for (let r = 2; r <= sheetInput.rows.length + 1; r++) {
          if (r % 2 === 0) {
            sheet.getRow(r).eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
          }
        }

        if (sheetInput.chartId) {
          const chart = charts.find((c) => c.id === sheetInput.chartId);
          if (chart?.imageUrl) {
            try {
              const res = await fetch(chart.imageUrl);
              const buffer = Buffer.from(await res.arrayBuffer());
              const imageId = workbook.addImage({ buffer: buffer as any, extension: 'png' });
              const anchorRow = sheetInput.rows.length + 3;
              sheet.addImage(imageId, {
                tl: { col: 0, row: anchorRow },
                ext: { width: 600, height: 360 },
              });
            } catch {
              // Skip a chart that fails to fetch rather than failing the workbook.
            }
          }
        }
      }

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = safeFilename(params.filename || params.title, 'spreadsheet') + '.xlsx';

      const upload = await uploadMedia(buffer, {
        kind: 'document',
        userId: context.userId,
        extension: 'xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      return {
        success: true,
        data: {
          url: upload.url,
          filename,
          sheetCount: params.sheets.length,
          bytes: upload.bytes,
          persisted: upload.persisted,
        },
        metadata: { duration: Date.now() - startTime, credits: XLSX_CREDITS },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XLSX generation failed',
        metadata: { duration: Date.now() - startTime, credits: 0 },
      };
    }
  }
}
