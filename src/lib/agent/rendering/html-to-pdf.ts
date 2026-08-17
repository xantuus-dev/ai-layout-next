/**
 * HTML-to-PDF Rendering
 *
 * Renders a styled HTML document to a PDF buffer via the shared headless
 * Chromium instance. Used by DocumentCreatePdfTool for real CSS layout
 * (tables, images, page breaks, headers/footers) instead of jsPDF's manual
 * text pagination.
 */

import { withRenderPage } from './puppeteer-pool';
import { getTheme, buildPdfPageCss } from './document-theme';
import type {
  DocumentSection,
  ChartSpec,
  TableSpec,
  ImageAsset,
  Citation,
} from '@/lib/documents/types';

export interface PdfRenderInput {
  title: string;
  subtitle?: string;
  sections: DocumentSection[];
  charts?: ChartSpec[];
  tables?: TableSpec[];
  images?: ImageAsset[];
  citations?: Citation[];
  theme?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Turns `[c1]` inline citation markers into superscript reference links. */
function renderInlineCitations(text: string, citations: Citation[]): string {
  const idIndex = new Map(citations.map((c, i) => [c.id, i + 1]));
  return escapeHtml(text).replace(/\[(c\d+)\]/g, (match, id) => {
    const n = idIndex.get(id);
    return n ? `<sup class="cite">[${n}]</sup>` : '';
  });
}

function renderParagraphs(content: string, citations: Citation[]): string {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${renderInlineCitations(p, citations)}</p>`)
    .join('\n');
}

function renderSection(section: DocumentSection, spec: PdfRenderInput): string {
  const tag = section.level === 1 ? 'h1' : section.level === 2 ? 'h2' : 'h3';
  const citations = spec.citations || [];
  const parts: string[] = [`<${tag}>${escapeHtml(section.heading)}</${tag}>`];
  parts.push(renderParagraphs(section.content, citations));

  for (const chartId of section.chartIds || []) {
    const chart = (spec.charts || []).find((c) => c.id === chartId);
    if (chart?.imageUrl) {
      parts.push(
        `<figure><img src="${chart.imageUrl}" alt="${escapeHtml(chart.title)}"><figcaption>${escapeHtml(
          chart.title
        )}</figcaption></figure>`
      );
    }
  }

  for (const tableId of section.tableIds || []) {
    const table = (spec.tables || []).find((t) => t.id === tableId);
    if (table) parts.push(renderTable(table));
  }

  for (const imageId of section.imageIds || []) {
    const image = (spec.images || []).find((i) => i.id === imageId);
    if (image?.url) {
      parts.push(`<figure><img src="${image.url}" alt="${escapeHtml(image.altText)}"></figure>`);
    }
  }

  return parts.join('\n');
}

function renderTable(table: TableSpec): string {
  const highlightMap = new Map(
    (table.highlightCells || []).map((h) => [`${h.row}:${h.col}`, h.style])
  );
  const head = `<tr>${table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const rows = table.rows
    .map(
      (row, r) =>
        `<tr>${row
          .map((cell, c) => {
            const style = highlightMap.get(`${r}:${c}`);
            const cls = style === 'positive' ? ' class="cell-positive"' : style === 'negative' ? ' class="cell-negative"' : '';
            return `<td${cls}>${escapeHtml(String(cell))}</td>`;
          })
          .join('')}</tr>`
    )
    .join('\n');

  return `<figure><table>${head}${rows}</table><figcaption>${escapeHtml(table.title)}</figcaption></figure>`;
}

function renderBibliography(citations: Citation[]): string {
  if (!citations.length) return '';
  const items = citations
    .map(
      (c, i) =>
        `<li>[${i + 1}] ${escapeHtml(c.title)}${c.author ? `, ${escapeHtml(c.author)}` : ''} — <a href="${c.url}">${escapeHtml(
          c.url
        )}</a> (accessed ${c.accessedDate})</li>`
    )
    .join('\n');
  return `<div class="bibliography"><h1>References</h1><ol>${items}</ol></div>`;
}

export function buildDocumentHtml(spec: PdfRenderInput): string {
  const theme = getTheme(spec.theme);
  const css = buildPdfPageCss(theme);
  const sectionsHtml = spec.sections.map((s) => renderSection(s, spec)).join('\n');
  const bibliography = renderBibliography(spec.citations || []);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
<div class="cover">
  <h1>${escapeHtml(spec.title)}</h1>
  <div class="accent-bar"></div>
  ${spec.subtitle ? `<div class="subtitle">${escapeHtml(spec.subtitle)}</div>` : ''}
</div>
<section>
${sectionsHtml}
</section>
${bibliography}
</body>
</html>`;
}

/** Header/footer templates for page.pdf(); Puppeteer requires these as separate HTML snippets. */
function buildHeaderFooterTemplates(title: string) {
  const headerTemplate = `
    <div style="font-size:8px; width:100%; padding:0 56px; color:#94A3B8; font-family: Helvetica, Arial, sans-serif;">
      ${escapeHtml(title)}
    </div>`;
  const footerTemplate = `
    <div style="font-size:8px; width:100%; padding:0 56px; color:#94A3B8; font-family: Helvetica, Arial, sans-serif; display:flex; justify-content:flex-end;">
      <span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>
    </div>`;
  return { headerTemplate, footerTemplate };
}

export async function renderHtmlToPdf(spec: PdfRenderInput): Promise<Buffer> {
  const html = buildDocumentHtml(spec);
  const { headerTemplate, footerTemplate } = buildHeaderFooterTemplates(spec.title);

  return withRenderPage(async (page) => {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Belt-and-suspenders: networkidle0 covers most cases, but explicitly
    // wait for any <img> tags to finish decoding before printing, since a
    // page.pdf() firing before images resolve is Puppeteer's classic footgun.
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete ? Promise.resolve() : new Promise((res) => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
          })
        )
      );
    });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: '48px', bottom: '48px', left: '0px', right: '0px' },
    });

    return Buffer.from(pdf);
  });
}
