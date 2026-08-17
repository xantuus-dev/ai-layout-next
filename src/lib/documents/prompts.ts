/**
 * Prompt templates for the document generation pipeline phases. Kept out of
 * the phase files so the wording can be reviewed/tuned independently of the
 * orchestration logic that calls them.
 */

import type { DocumentOutlineItem, DocumentSection, Citation } from './types';

export function buildSearchQueriesPrompt(goal: string): string {
  return `You are planning research for a document. Given the goal below, produce 2-4 focused web search queries that would gather the facts needed to write it well. Prefer specific, factual queries over vague ones.

GOAL: ${goal}

Return ONLY a JSON array of query strings, e.g. ["query one", "query two"].`;
}

export function buildOutlinePrompt(
  goal: string,
  searchSnippets: { title: string; url: string; snippet: string }[]
): string {
  const research = searchSnippets.length
    ? searchSnippets.map((s, i) => `[${i + 1}] ${s.title} — ${s.snippet} (${s.url})`).join('\n')
    : '(no web research available — outline from general knowledge)';

  return `You are structuring a professional document. Given the goal and any research below, produce a title, optional subtitle, and a section outline.

GOAL: ${goal}

RESEARCH:
${research}

Return ONLY JSON in this exact shape:
{
  "title": "Document title",
  "subtitle": "Optional one-line subtitle, or empty string",
  "outline": [
    {
      "heading": "Section heading",
      "level": 1,
      "intent": "One sentence describing what this section should cover",
      "needsChart": false,
      "needsTable": false,
      "needsImage": false
    }
  ]
}

Guidelines:
- 3-7 sections. level is 1 for top-level sections, 2 for subsections.
- Set needsChart true only for sections that would benefit from a data visualization (trends, comparisons, breakdowns).
- Set needsTable true only for sections presenting structured comparative data.
- Set needsImage true only for sections that would benefit from a supporting illustration (rare — most business sections don't need one).
- The first section should usually be an executive summary / overview.`;
}

export function buildSectionDraftPrompt(
  goal: string,
  item: DocumentOutlineItem,
  citations: Citation[]
): string {
  const citationList = citations.length
    ? citations.map((c) => `[${c.id}] ${c.title} (${c.url})`).join('\n')
    : '(no sources available — write from general knowledge, do not fabricate citation markers)';

  return `Write the body content for one section of a professional document.

DOCUMENT GOAL: ${goal}
SECTION HEADING: ${item.heading}
SECTION INTENT: ${item.intent}

AVAILABLE SOURCES (cite inline as [c1], [c2] etc. where relevant — only cite ids that appear below):
${citationList}

Write 2-4 short paragraphs (blank line between paragraphs) of clear, professional prose. No heading — just the body text. Do not repeat the section heading. Do not use markdown formatting other than plain paragraphs.`;
}

export function buildChartSpecPrompt(goal: string, item: DocumentOutlineItem, sectionContent: string): string {
  return `Given this document section, produce a chart specification that visualizes the key data point it discusses.

DOCUMENT GOAL: ${goal}
SECTION: ${item.heading} — ${item.intent}
SECTION CONTENT: ${sectionContent}

Return ONLY JSON in this exact shape:
{
  "type": "bar",
  "title": "Chart title",
  "labels": ["Label A", "Label B"],
  "series": [{ "name": "Series name", "data": [1, 2] }]
}

type must be one of: bar, line, pie, doughnut, scatter. If the section content contains real numbers, use them. If it does not, infer illustrative-but-plausible figures consistent with the section's narrative (this is expected for a draft report) — do not leave data empty.`;
}

export function buildTableSpecPrompt(goal: string, item: DocumentOutlineItem, sectionContent: string): string {
  return `Given this document section, produce a data table that presents its key comparison or breakdown.

DOCUMENT GOAL: ${goal}
SECTION: ${item.heading} — ${item.intent}
SECTION CONTENT: ${sectionContent}

Return ONLY JSON in this exact shape:
{
  "title": "Table title",
  "columns": ["Column A", "Column B"],
  "rows": [["value", "value"], ["value", "value"]]
}

Use real numbers from the section content where present, otherwise plausible illustrative figures. Keep it to 3-8 rows and 2-5 columns.`;
}

export function buildImagePromptFromSection(goal: string, item: DocumentOutlineItem): string {
  return `A professional, editorial-style illustration for a business document section titled "${item.heading}" (${item.intent}), in the context of: ${goal}. Clean, modern, minimal — no text or logos in the image.`;
}

export function buildSlideBulletsPrompt(section: DocumentSection): string {
  return `Condense this document section into 3-5 short slide bullet points (max ~10 words each), suitable for a presentation slide.

SECTION: ${section.heading}
CONTENT: ${section.content}

Return ONLY a JSON array of bullet strings.`;
}
