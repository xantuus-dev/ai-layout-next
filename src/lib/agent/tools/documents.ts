/**
 * Document Tools - Produce real files (PDF, Word, PowerPoint) from agent output
 *
 * These turn model text into downloadable artifacts rather than chat messages.
 * Generation is pure local compute except for chart/image URLs the caller
 * already produced (via chart.render / image.generate), so credit cost only
 * covers CPU, browser rendering, and storage.
 *
 * The heavy renderers are dynamically imported inside execute(), matching
 * the rest of this module: they are large, Node-only, and would otherwise be
 * pulled into any bundle that touches the tool registry.
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { uploadMedia } from '@/lib/storage';
import { renderHtmlToPdf } from '../rendering/html-to-pdf';
import type { ChartSpec, TableSpec, ImageAsset, Citation, DocumentSection } from '@/lib/documents/types';

/** Local rendering only — no provider spend, so these stay cheap. */
const DOCUMENT_CREDITS = {
  pdf: 3,
  docx: 3,
  deck: 5,
} as const;

const MAX_CONTENT_CHARS = 100_000;

/** Strip characters that break filenames across OSes, keep it recognisable. */
function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || fallback)
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || fallback;
}

function ok(data: any, credits: number, startTime: number): ToolResult {
  return { success: true, data, metadata: { duration: Date.now() - startTime, credits } };
}

function fail(error: string, startTime: number): ToolResult {
  return { success: false, error, metadata: { duration: Date.now() - startTime, credits: 0 } };
}

function validateTitleAndContent(params: any): { valid: boolean; error?: string } {
  if (!params?.title || typeof params.title !== 'string') {
    return { valid: false, error: 'title parameter required (string)' };
  }
  if (params.sections) {
    if (!Array.isArray(params.sections) || params.sections.length === 0) {
      return { valid: false, error: 'sections must be a non-empty array when provided' };
    }
    return { valid: true };
  }
  if (!params?.content || typeof params.content !== 'string') {
    return { valid: false, error: 'content or sections parameter required' };
  }
  if (params.content.length > MAX_CONTENT_CHARS) {
    return { valid: false, error: `content exceeds ${MAX_CONTENT_CHARS} characters` };
  }
  return { valid: true };
}

/** Plain text ("# " headings, blank-line paragraphs) -> one DocumentSection per block. */
function sectionsFromPlainText(content: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let bodyBuffer: string[] = [];
  let idx = 0;

  const flushBody = () => {
    if (bodyBuffer.length) {
      sections.push({ id: `s${idx++}`, heading: '', level: 2, content: bodyBuffer.join('\n\n') });
      bodyBuffer = [];
    }
  };

  for (const block of content.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text) continue;
    const heading = text.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushBody();
      const level = heading[1].length as 1 | 2 | 3;
      sections.push({ id: `s${idx++}`, heading: heading[2], level, content: '' });
    } else {
      bodyBuffer.push(text);
    }
  }
  flushBody();
  return sections;
}

interface RichDocParams {
  title: string;
  subtitle?: string;
  content?: string;
  sections?: DocumentSection[];
  charts?: ChartSpec[];
  tables?: TableSpec[];
  images?: ImageAsset[];
  citations?: Citation[];
  includeToc?: boolean;
  theme?: string;
  filename?: string;
}

function resolveSections(params: RichDocParams): DocumentSection[] {
  if (params.sections?.length) return params.sections;
  return sectionsFromPlainText(params.content || '');
}

/**
 * Create a professionally formatted PDF via headless-Chromium HTML rendering
 * — real CSS layout (tables, images, headers/footers, page breaks) instead
 * of jsPDF's manual text pagination.
 */
export class DocumentCreatePdfTool implements AgentTool {
  name = 'document.createPdf';
  description =
    'Create a PDF document and return a download URL. Use for reports, summaries, and ' +
    'anything the user should be able to save or print. Accepts either plain "content" ' +
    '(blank lines separate paragraphs, "# " lines become headings) for simple documents, ' +
    'or structured "sections" plus "charts"/"tables"/"images"/"citations" for rich reports ' +
    'with embedded chart images (see chart.render), data tables, images, and a references list.';
  category = 'document' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Document title, shown on the cover' },
      subtitle: { type: 'string', description: 'Optional cover subtitle' },
      content: { type: 'string', description: 'Simple document body text; blank lines separate paragraphs' },
      sections: {
        type: 'array',
        description: 'Structured sections, each with heading/level/content and optional chartIds/tableIds/imageIds',
        items: { type: 'object' },
      },
      charts: { type: 'array', description: 'Chart specs (from chart.render output) referenced by sections', items: { type: 'object' } },
      tables: { type: 'array', description: 'Table specs referenced by sections', items: { type: 'object' } },
      images: { type: 'array', description: 'Image assets referenced by sections', items: { type: 'object' } },
      citations: { type: 'array', description: 'Sources; inline-referenced in section content as [c1]', items: { type: 'object' } },
      theme: { type: 'string', description: 'Named theme preset', enum: ['default', 'investor', 'minimal'] },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title'],
  };

  validate(params: any) {
    return validateTitleAndContent(params);
  }

  estimateCost(): number {
    return DOCUMENT_CREDITS.pdf;
  }

  async execute(params: RichDocParams, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const sections = resolveSections(params);
      const buffer = await renderHtmlToPdf({
        title: params.title,
        subtitle: params.subtitle,
        sections,
        charts: params.charts,
        tables: params.tables,
        images: params.images,
        citations: params.citations,
        theme: params.theme,
      });

      const filename = safeFilename(params.filename || params.title, 'document') + '.pdf';
      const upload = await uploadMedia(buffer, {
        kind: 'document',
        userId: context.userId,
        extension: 'pdf',
        contentType: 'application/pdf',
      });

      return ok(
        { url: upload.url, filename, bytes: upload.bytes, persisted: upload.persisted },
        DOCUMENT_CREDITS.pdf,
        startTime
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'PDF generation failed', startTime);
    }
  }
}

/**
 * Create a Word document from text, optionally with images, tables, a table
 * of contents, and a references section built from citations.
 */
export class DocumentCreateDocxTool implements AgentTool {
  name = 'document.createDocx';
  description =
    'Create an editable Word (.docx) document and return a download URL. Prefer this over ' +
    'PDF when the user will edit the result. Accepts plain "content" (lines starting with ' +
    '"# " become headings, blank lines separate paragraphs) or structured "sections". ' +
    'Optionally embeds "images", "tables", a table of contents ("includeToc"), and a ' +
    'References section built from "citations".';
  category = 'document' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Document title' },
      content: { type: 'string', description: 'Simple document body text' },
      sections: { type: 'array', description: 'Structured sections (heading/level/content + chartIds/tableIds/imageIds)', items: { type: 'object' } },
      charts: { type: 'array', description: 'Chart specs referenced by sections', items: { type: 'object' } },
      tables: { type: 'array', description: 'Table specs referenced by sections', items: { type: 'object' } },
      images: { type: 'array', description: 'Image assets referenced by sections', items: { type: 'object' } },
      citations: { type: 'array', description: 'Sources; inline-referenced in section content as [c1]', items: { type: 'object' } },
      includeToc: { type: 'boolean', description: 'Insert an auto-generated table of contents after the title' },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title'],
  };

  validate(params: any) {
    return validateTitleAndContent(params);
  }

  estimateCost(): number {
    return DOCUMENT_CREDITS.docx;
  }

  async execute(params: RichDocParams, context: AgentContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        HeadingLevel,
        ImageRun,
        Table,
        TableRow,
        TableCell,
        WidthType,
        TableOfContents,
        ShadingType,
      } = await import('docx');

      const sections = resolveSections(params);
      const charts = params.charts || [];
      const tables = params.tables || [];
      const images = params.images || [];
      const citations = params.citations || [];
      const citationIndex = new Map(citations.map((c, i) => [c.id, i + 1]));

      const children: any[] = [new Paragraph({ text: params.title, heading: HeadingLevel.TITLE })];

      if (params.includeToc) {
        children.push(
          new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }),
          new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' })
        );
      }

      const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

      const stripCitationMarkers = (text: string) =>
        text.replace(/\[(c\d+)\]/g, (m, id) => (citationIndex.has(id) ? `[${citationIndex.get(id)}]` : ''));

      for (const section of sections) {
        if (section.heading) {
          children.push(
            new Paragraph({ text: section.heading, heading: headingLevels[Math.max(0, section.level - 1)] })
          );
        }
        for (const block of section.content.split(/\n\s*\n/)) {
          const text = block.trim();
          if (!text) continue;
          const heading = text.match(/^(#{1,3})\s+(.*)$/);
          if (heading) {
            children.push(
              new Paragraph({ text: heading[2], heading: headingLevels[heading[1].length - 1] })
            );
            continue;
          }
          children.push(
            new Paragraph({
              children: [new TextRun(stripCitationMarkers(text))],
              spacing: { after: 200 },
            })
          );
        }

        // Charts embed as images (PNG already rendered by chart.render).
        for (const chartId of section.chartIds || []) {
          const chart = charts.find((c) => c.id === chartId);
          if (chart?.imageUrl) {
            try {
              const res = await fetch(chart.imageUrl);
              const buf = Buffer.from(await res.arrayBuffer());
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({ data: buf, transformation: { width: 500, height: 300 }, type: 'png' }),
                  ],
                  spacing: { before: 120, after: 120 },
                })
              );
            } catch {
              // Skip a chart that failed to fetch rather than failing the whole document.
            }
          }
        }

        for (const imageId of section.imageIds || []) {
          const image = images.find((i) => i.id === imageId);
          if (image?.url) {
            try {
              const res = await fetch(image.url);
              const buf = Buffer.from(await res.arrayBuffer());
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({ data: buf, transformation: { width: 450, height: 300 }, type: 'png' }),
                  ],
                  spacing: { before: 120, after: 120 },
                })
              );
            } catch {
              // Skip images that fail to fetch.
            }
          }
        }

        for (const tableId of section.tableIds || []) {
          const table = tables.find((t) => t.id === tableId);
          if (table) children.push(buildDocxTable(table, { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType }));
        }
      }

      if (citations.length) {
        children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }));
        citations.forEach((c, i) => {
          const label = `[${i + 1}] ${c.title}${c.author ? `, ${c.author}` : ''} — ${c.url} (accessed ${c.accessedDate})`;
          children.push(new Paragraph({ children: [new TextRun({ text: label, size: 18 })], spacing: { after: 100 } }));
        });
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const buffer = await Packer.toBuffer(doc);
      const filename = safeFilename(params.filename || params.title, 'document') + '.docx';

      const upload = await uploadMedia(buffer, {
        kind: 'document',
        userId: context.userId,
        extension: 'docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      return ok(
        { url: upload.url, filename, bytes: upload.bytes, persisted: upload.persisted },
        DOCUMENT_CREDITS.docx,
        startTime
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'DOCX generation failed', startTime);
    }
  }
}

function buildDocxTable(
  table: TableSpec,
  ctor: { Table: any; TableRow: any; TableCell: any; Paragraph: any; TextRun: any; WidthType: any; ShadingType: any }
): any {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType } = ctor;

  const headerRow = new TableRow({
    children: table.columns.map(
      (col) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: '0D9488' },
          children: [new Paragraph({ children: [new TextRun({ text: col, bold: true, color: 'FFFFFF' })] })],
        })
    ),
  });

  const rows = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(String(cell))] })],
            })
        ),
      })
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] });
}

/**
 * Create a PowerPoint deck from structured slides, optionally with charts,
 * images, and speaker-note citation callouts.
 */
export class DocumentCreateDeckTool implements AgentTool {
  name = 'document.createDeck';
  description =
    'Create a PowerPoint (.pptx) presentation and return a download URL. Takes a slides ' +
    'array, each with a title and bullet points, plus optional chartId (rendered via ' +
    'chart.render), imageUrl, and speakerNotes (e.g. citation callouts). Use for pitch ' +
    'decks, proposals, and any request for a presentation.';
  category = 'document' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Presentation title, shown on the cover slide' },
      subtitle: { type: 'string', description: 'Optional cover slide subtitle' },
      slides: {
        type: 'array',
        description: 'Content slides (max 50)',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            chartId: { type: 'string', description: 'Chart from the charts array to embed on this slide' },
            imageUrl: { type: 'string', description: 'Image URL to embed on this slide' },
            speakerNotes: { type: 'string', description: 'Speaker notes, e.g. source citations for this slide' },
          },
          required: ['title'],
        },
      },
      charts: { type: 'array', description: 'Chart specs (from chart.render) referenced by slides via chartId', items: { type: 'object' } },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title', 'slides'],
  };

  validate(params: any) {
    if (!params?.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }
    if (!Array.isArray(params.slides) || params.slides.length === 0) {
      return { valid: false, error: 'slides parameter required (non-empty array)' };
    }
    if (params.slides.length > 50) {
      return { valid: false, error: 'slides limited to 50 per deck' };
    }
    for (const [i, slide] of params.slides.entries()) {
      if (!slide?.title || typeof slide.title !== 'string') {
        return { valid: false, error: `slides[${i}].title required (string)` };
      }
      if (slide.bullets && !Array.isArray(slide.bullets)) {
        return { valid: false, error: `slides[${i}].bullets must be an array of strings` };
      }
    }
    return { valid: true };
  }

  estimateCost(): number {
    return DOCUMENT_CREDITS.deck;
  }

  async execute(
    params: {
      title: string;
      subtitle?: string;
      slides: { title: string; bullets?: string[]; chartId?: string; imageUrl?: string; speakerNotes?: string }[];
      charts?: ChartSpec[];
      filename?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();

      pptx.layout = 'LAYOUT_16x9';
      pptx.title = params.title;

      // Brand palette, matching the teal/emerald identity used on the site.
      const ACCENT = '0D9488';
      const DARK = '0F172A';
      const BODY = '334155';
      const charts = params.charts || [];

      // Title slide
      const cover = pptx.addSlide();
      cover.background = { color: DARK };
      cover.addText(params.title, {
        x: 0.6,
        y: 1.9,
        w: 8.8,
        h: 1.2,
        fontSize: 40,
        bold: true,
        color: 'FFFFFF',
      });
      if (params.subtitle) {
        cover.addText(params.subtitle, {
          x: 0.6,
          y: 3.1,
          w: 8.8,
          h: 0.8,
          fontSize: 18,
          color: '94A3B8',
        });
      }
      cover.addShape(pptx.ShapeType.rect, {
        x: 0.6,
        y: 1.6,
        w: 1.4,
        h: 0.08,
        fill: { color: ACCENT },
      });

      // Content slides
      for (const slide of params.slides) {
        const s = pptx.addSlide();
        s.addText(slide.title, {
          x: 0.6,
          y: 0.5,
          w: 8.8,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: DARK,
        });
        s.addShape(pptx.ShapeType.rect, {
          x: 0.6,
          y: 1.3,
          w: 0.9,
          h: 0.06,
          fill: { color: ACCENT },
        });

        const hasMedia = Boolean(slide.chartId || slide.imageUrl);
        const bullets = (slide.bullets || []).filter(
          (b): b is string => typeof b === 'string' && b.trim().length > 0
        );
        if (bullets.length > 0) {
          s.addText(
            bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
            {
              x: 0.7,
              y: 1.7,
              w: hasMedia ? 4.1 : 8.6,
              h: 3.4,
              fontSize: 16,
              color: BODY,
              lineSpacing: 28,
            }
          );
        }

        const chart = slide.chartId ? charts.find((c) => c.id === slide.chartId) : undefined;
        const mediaUrl = chart?.imageUrl || slide.imageUrl;
        if (mediaUrl) {
          try {
            const res = await fetch(mediaUrl);
            const buf = Buffer.from(await res.arrayBuffer());
            const b64 = `data:image/png;base64,${buf.toString('base64')}`;
            s.addImage({
              data: b64,
              x: bullets.length > 0 ? 5.0 : 0.7,
              y: 1.7,
              w: bullets.length > 0 ? 4.3 : 8.6,
              h: 3.4,
            });
          } catch {
            // Skip media that fails to fetch rather than failing the deck.
          }
        }

        if (slide.speakerNotes) {
          s.addNotes(slide.speakerNotes);
        }
      }

      const output = (await pptx.write({ outputType: 'nodebuffer' })) as unknown as Buffer;
      const filename = safeFilename(params.filename || params.title, 'presentation') + '.pptx';

      const upload = await uploadMedia(output, {
        kind: 'document',
        userId: context.userId,
        extension: 'pptx',
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      return ok(
        {
          url: upload.url,
          filename,
          slideCount: params.slides.length,
          bytes: upload.bytes,
          persisted: upload.persisted,
        },
        DOCUMENT_CREDITS.deck,
        startTime
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Deck generation failed', startTime);
    }
  }
}
