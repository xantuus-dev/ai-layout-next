/**
 * Shared Document Theme
 *
 * Single source of truth for the brand palette and typography used across
 * PDF (Puppeteer HTML), chart rendering, DOCX, PPTX, and XLSX generation, so
 * a document looks consistent regardless of which output format was chosen.
 */

export interface DocumentTheme {
  name: 'default' | 'investor' | 'minimal';
  accent: string; // hex, no leading #
  dark: string;
  body: string;
  muted: string;
  fontFamily: string;
}

export const THEMES: Record<DocumentTheme['name'], DocumentTheme> = {
  default: {
    name: 'default',
    accent: '0D9488',
    dark: '0F172A',
    body: '334155',
    muted: '64748B',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  investor: {
    name: 'investor',
    accent: '1D4ED8',
    dark: '0B1220',
    body: '1E293B',
    muted: '64748B',
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  minimal: {
    name: 'minimal',
    accent: '111827',
    dark: '111827',
    body: '374151',
    muted: '6B7280',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
};

export function getTheme(name?: string): DocumentTheme {
  return THEMES[(name as DocumentTheme['name']) || 'default'] || THEMES.default;
}

export function hex(color: string): string {
  return color.startsWith('#') ? color : `#${color}`;
}

/** Shared page CSS for Puppeteer HTML-to-PDF rendering — header/footer, page breaks, tables, images. */
export function buildPdfPageCss(theme: DocumentTheme): string {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: ${theme.fontFamily};
      color: ${hex(theme.body)};
      margin: 0;
      font-size: 11pt;
      line-height: 1.5;
    }
    .cover {
      padding: 72px 56px 0;
    }
    .cover h1 {
      font-size: 32pt;
      color: ${hex(theme.dark)};
      margin: 0 0 8px;
    }
    .cover .accent-bar {
      width: 64px;
      height: 4px;
      background: ${hex(theme.accent)};
      margin: 16px 0 24px;
    }
    .cover .subtitle {
      font-size: 13pt;
      color: ${hex(theme.muted)};
    }
    section {
      padding: 0 56px;
    }
    h1, h2, h3 {
      color: ${hex(theme.dark)};
      page-break-after: avoid;
    }
    h1 { font-size: 20pt; margin-top: 32px; }
    h2 { font-size: 16pt; margin-top: 24px; }
    h3 { font-size: 13pt; margin-top: 18px; }
    p { margin: 0 0 12px; }
    .page-break { page-break-before: always; }
    figure {
      margin: 16px 0;
      page-break-inside: avoid;
      text-align: center;
    }
    figure img { max-width: 100%; }
    figcaption {
      font-size: 9pt;
      color: ${hex(theme.muted)};
      margin-top: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th {
      background: ${hex(theme.accent)};
      color: #FFFFFF;
      text-align: left;
      padding: 8px 10px;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #E2E8F0;
    }
    tr:nth-child(even) td { background: #F8FAFC; }
    .cell-positive { color: #15803D; font-weight: 600; }
    .cell-negative { color: #B91C1C; font-weight: 600; }
    .bibliography {
      page-break-before: always;
      padding: 0 56px;
    }
    .bibliography li {
      font-size: 9.5pt;
      color: ${hex(theme.muted)};
      margin-bottom: 8px;
    }
    .cite {
      font-size: 8pt;
      vertical-align: super;
      color: ${hex(theme.accent)};
    }
  `;
}
