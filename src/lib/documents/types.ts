/**
 * Document Generation Pipeline — Shared Domain Types
 *
 * DocumentSpec is the state object that flows through the multi-agent
 * document generation pipeline (research -> drafting -> data_chart -> images
 * -> qa -> assembly). It's also the vocabulary the rendering tools
 * (chart.render, document.createPdf/Docx/Deck/Xlsx) speak, so a document
 * looks the same regardless of which phase or output format produced it.
 */

export type DocumentFormat = 'docx' | 'pdf' | 'pptx' | 'xlsx';

export type DocumentPhaseName =
  | 'research'
  | 'drafting'
  | 'data_chart'
  | 'images'
  | 'assembly'
  | 'qa';

export interface Citation {
  id: string; // stable short id, e.g. "c1" — referenced inline as [c1]
  title: string;
  url: string;
  author?: string;
  publishedDate?: string;
  accessedDate: string; // ISO date, set when gathered
  sourceTool: 'web.search' | 'manual';
}

export interface ChartSpec {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
  title: string;
  labels: string[];
  series: { name: string; data: number[] }[];
  /** Filled in once chart.render has produced an image. */
  imageUrl?: string;
}

export interface TableSpec {
  id: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
  highlightCells?: { row: number; col: number; style: 'positive' | 'negative' | 'neutral' }[];
}

export interface ImageAsset {
  id: string;
  purpose: string; // e.g. "hero image for cover slide"
  url?: string; // set once sourced/generated
  source: 'generated' | 'user_provided' | 'url';
  altText: string;
}

export interface DocumentSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  /** Body text; citation refs appear inline as [c1]. */
  content: string;
  chartIds?: string[];
  tableIds?: string[];
  imageIds?: string[];
}

export interface DocumentOutlineItem {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  intent: string; // what this section should cover — the drafting phase's brief
  needsChart?: boolean;
  needsTable?: boolean;
  needsImage?: boolean;
}

export interface GeneratedOutput {
  format: DocumentFormat;
  url: string;
  filename: string;
  bytes: number;
  persisted: boolean;
  generatedAt: string;
}

export interface PhaseLogEntry {
  phase: DocumentPhaseName;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  summary?: string;
  error?: string;
  /** Set when QA sends the pipeline back to an earlier phase. */
  revisionOf?: DocumentPhaseName;
}

export interface QaIssue {
  severity: 'blocker' | 'warning';
  message: string;
  targetPhase: DocumentPhaseName;
}

export interface DocumentSpec {
  version: 1;
  goal: string;
  requestedFormats: DocumentFormat[];
  theme: 'default' | 'investor' | 'minimal';

  /** Set by the research phase once it has enough context to title the document. */
  title?: string;
  subtitle?: string;

  outline: DocumentOutlineItem[];
  sections: DocumentSection[];
  citations: Citation[];
  charts: ChartSpec[];
  tables: TableSpec[];
  images: ImageAsset[];

  outputs: GeneratedOutput[];

  currentPhase: DocumentPhaseName;
  phaseLog: PhaseLogEntry[];
  qaIssues?: QaIssue[];
  /** Guards against an unbounded QA loop-back; capped at 2 revisions. */
  revisionCount: number;
}

export function initDocumentSpec(
  goal: string,
  requestedFormats: DocumentFormat[],
  theme: DocumentSpec['theme'] = 'default'
): DocumentSpec {
  return {
    version: 1,
    goal,
    requestedFormats,
    theme,
    outline: [],
    sections: [],
    citations: [],
    charts: [],
    tables: [],
    images: [],
    outputs: [],
    currentPhase: 'research',
    phaseLog: [],
    revisionCount: 0,
  };
}
