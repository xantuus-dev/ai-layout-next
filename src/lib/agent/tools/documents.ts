/**
 * Document Tools - Produce real files (PDF, Word, PowerPoint) from agent output
 *
 * These turn model text into downloadable artifacts rather than chat messages.
 * Generation is pure local compute — no provider API — so the credit cost only
 * covers CPU and storage.
 *
 * The heavy renderers are dynamically imported inside execute(), matching
 * lib/docx-generator.ts: they are large, Node-only, and would otherwise be
 * pulled into any bundle that touches the tool registry.
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { uploadMedia } from '@/lib/storage';

/** Local rendering only — no provider spend, so these stay cheap. */
const DOCUMENT_CREDITS = {
  pdf: 2,
  docx: 2,
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
  if (!params?.content || typeof params.content !== 'string') {
    return { valid: false, error: 'content parameter required (string)' };
  }
  if (params.content.length > MAX_CONTENT_CHARS) {
    return { valid: false, error: `content exceeds ${MAX_CONTENT_CHARS} characters` };
  }
  return { valid: true };
}

/**
 * Create a PDF report from plain text.
 */
export class DocumentCreatePdfTool implements AgentTool {
  name = 'document.createPdf';
  description =
    'Create a PDF document from text and return a download URL. Use for reports, ' +
    'summaries, invoices, and anything the user should be able to save or print. ' +
    'Blank lines separate paragraphs.';
  category = 'data' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Document title, shown at the top of the PDF' },
      content: { type: 'string', description: 'Document body text; blank lines separate paragraphs' },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title', 'content'],
  };

  validate(params: any) {
    return validateTitleAndContent(params);
  }

  estimateCost(): number {
    return DOCUMENT_CREDITS.pdf;
  }

  async execute(
    params: { title: string; content: string; filename?: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });

      const MARGIN = 56;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - MARGIN * 2;
      let cursorY = MARGIN;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      for (const line of doc.splitTextToSize(params.title, usableWidth)) {
        doc.text(line, MARGIN, cursorY);
        cursorY += 26;
      }
      cursorY += 10;

      // Body — paragraphs split on blank lines, wrapped and paginated manually
      // because jsPDF has no flow layout.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const LINE_HEIGHT = 16;

      for (const paragraph of params.content.split(/\n\s*\n/)) {
        const text = paragraph.trim();
        if (!text) continue;

        for (const line of doc.splitTextToSize(text, usableWidth)) {
          if (cursorY > pageHeight - MARGIN) {
            doc.addPage();
            cursorY = MARGIN;
          }
          doc.text(line, MARGIN, cursorY);
          cursorY += LINE_HEIGHT;
        }
        cursorY += LINE_HEIGHT * 0.5;
      }

      const buffer = Buffer.from(doc.output('arraybuffer'));
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
 * Create a Word document from text.
 */
export class DocumentCreateDocxTool implements AgentTool {
  name = 'document.createDocx';
  description =
    'Create an editable Word (.docx) document from text and return a download URL. ' +
    'Prefer this over PDF when the user will edit the result. Lines starting with ' +
    '"# " become headings; blank lines separate paragraphs.';
  category = 'data' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Document title' },
      content: { type: 'string', description: 'Document body text; lines starting with "# " become headings, blank lines separate paragraphs' },
      filename: { type: 'string', description: 'Optional filename (without extension)' },
    },
    required: ['title', 'content'],
  };

  validate(params: any) {
    return validateTitleAndContent(params);
  }

  estimateCost(): number {
    return DOCUMENT_CREDITS.docx;
  }

  async execute(
    params: { title: string; content: string; filename?: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

      const children: any[] = [
        new Paragraph({ text: params.title, heading: HeadingLevel.TITLE }),
      ];

      for (const block of params.content.split(/\n\s*\n/)) {
        const text = block.trim();
        if (!text) continue;

        // Markdown-style headings, since models reach for them unprompted.
        const heading = text.match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
          const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
          children.push(
            new Paragraph({ text: heading[2], heading: levels[heading[1].length - 1] })
          );
          continue;
        }

        children.push(
          new Paragraph({ children: [new TextRun(text)], spacing: { after: 200 } })
        );
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

/**
 * Create a PowerPoint deck from structured slides.
 */
export class DocumentCreateDeckTool implements AgentTool {
  name = 'document.createDeck';
  description =
    'Create a PowerPoint (.pptx) presentation and return a download URL. Takes a ' +
    'slides array, each with a title and bullet points. Use for pitch decks, ' +
    'proposals, and any request for a presentation.';
  category = 'data' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Presentation title, shown on the cover slide' },
      subtitle: { type: 'string', description: 'Optional cover slide subtitle' },
      slides: {
        type: 'array',
        description: 'Content slides, each with a title and optional bullet points (max 50)',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
          },
          required: ['title'],
        },
      },
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
      slides: { title: string; bullets?: string[] }[];
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

        const bullets = (slide.bullets || []).filter(
          (b): b is string => typeof b === 'string' && b.trim().length > 0
        );
        if (bullets.length > 0) {
          s.addText(
            bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
            { x: 0.7, y: 1.7, w: 8.6, h: 3.4, fontSize: 16, color: BODY, lineSpacing: 28 }
          );
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
