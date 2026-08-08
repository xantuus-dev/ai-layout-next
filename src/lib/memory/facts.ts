/**
 * Fact-based memory
 *
 * A deliberately small memory implementation built on the `MemoryFact` table
 * that already exists in the Prisma schema. It gives chat persistent knowledge
 * about a user without the pgvector subsystem in this directory (see
 * ./LEGACY.md — that code has never run against a real database).
 *
 * Retrieval is lexical, not semantic. That is a real limitation, and the
 * trade-off is deliberate: every scoring and parsing rule here is a pure
 * function that can be unit tested without a database or an embedding API.
 */

import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';

/** Fact categories the extractor is allowed to emit. */
export const FACT_TYPES = [
  'preference',
  'fact',
  'decision',
  'context',
  'goal',
  'skill',
] as const;

export type FactType = (typeof FACT_TYPES)[number];

export interface ScoredFact {
  id: string;
  factType: string;
  content: string;
  importanceScore: number;
  score: number;
}

/** A fact as produced by the extractor, before it is persisted. */
export interface ExtractedFact {
  factType: FactType;
  content: string;
  confidenceScore: number;
  importanceScore: number;
}

/** Retrieval inputs, kept separate from the Prisma row shape so scoring is testable. */
export interface RetrievableFact {
  id: string;
  factType: string;
  content: string;
  importanceScore: number;
  lastAccessed: Date;
}

// Words carrying no retrieval signal. Small on purpose — an aggressive list
// throws away short but meaningful queries like "my dog".
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do',
  'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is',
  'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'to', 'was', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
]);

const RECENCY_HALF_LIFE_DAYS = 30;

/**
 * Split text into lowercase terms worth matching on.
 * Exported for testing.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

/**
 * Score one fact against a query.
 *
 * Relevance blends two signals, because either alone misbehaves:
 *
 * - `strength` saturates in the absolute number of matched terms, so a fact
 *   hitting two query terms beats one hitting a single term.
 * - `coverage` is the fraction of the query the fact addresses, which favours
 *   facts that speak to the whole question.
 *
 * Coverage alone would score 1-of-1 and 2-of-2 identically, and would bury a
 * genuinely relevant fact under a long chatty message (1 match in 12 terms
 * scoring 0.08). Strength alone would ignore how much of the question was
 * answered. Importance and a mild recency decay break the remaining ties.
 *
 * Exported for testing.
 */
export function scoreFact(
  fact: RetrievableFact,
  queryTerms: string[],
  now: Date = new Date()
): number {
  if (queryTerms.length === 0) return 0;

  const factTerms = new Set(tokenize(fact.content));
  if (factTerms.size === 0) return 0;

  const matches = queryTerms.filter((term) => factTerms.has(term)).length;
  if (matches === 0) return 0;

  const strength = 1 - Math.pow(0.5, matches);
  const coverage = matches / queryTerms.length;
  const relevance = strength * 0.7 + coverage * 0.3;

  const ageDays = Math.max(
    0,
    (now.getTime() - fact.lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
  );
  const recency = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);

  return relevance * 0.6 + fact.importanceScore * 0.3 + recency * 0.1;
}

/**
 * Rank facts against a query and keep the best ones.
 * Pure — the database round trip happens in `retrieveRelevantFacts`.
 * Exported for testing.
 */
export function rankFacts(
  facts: RetrievableFact[],
  query: string,
  options: { limit?: number; minScore?: number; now?: Date } = {}
): ScoredFact[] {
  const { limit = 5, minScore = 0.15, now = new Date() } = options;
  const queryTerms = tokenize(query);

  return facts
    .map((fact) => ({
      id: fact.id,
      factType: fact.factType,
      content: fact.content,
      importanceScore: fact.importanceScore,
      score: scoreFact(fact, queryTerms, now),
    }))
    .filter((fact) => fact.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Render facts as a system-prompt block, or null when there is nothing useful.
 * Exported for testing.
 */
export function formatFactsForPrompt(facts: ScoredFact[]): string | null {
  if (facts.length === 0) return null;

  const lines = facts.map((fact) => `- (${fact.factType}) ${fact.content}`);

  return [
    'What you already know about this user, from earlier conversations:',
    ...lines,
    '',
    'Use this only when it is relevant. Do not mention that you are reading from memory, and do not repeat these facts back unless asked.',
  ].join('\n');
}

/**
 * Load a user's live facts and return the best matches for `query`.
 *
 * Candidates are capped rather than scored in the database: lexical ranking in
 * JS keeps this dependency-free, and a user with more than a few hundred facts
 * is a signal to move to embeddings rather than to widen this query.
 */
export async function retrieveRelevantFacts(
  userId: string,
  query: string,
  options: { limit?: number; candidatePoolSize?: number } = {}
): Promise<ScoredFact[]> {
  const { limit = 5, candidatePoolSize = 500 } = options;

  const now = new Date();
  const candidates = await prisma.memoryFact.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      factType: true,
      content: true,
      importanceScore: true,
      lastAccessed: true,
    },
    orderBy: { importanceScore: 'desc' },
    take: candidatePoolSize,
  });

  return rankFacts(candidates, query, { limit, now });
}

/**
 * Fetch memory context for a chat turn. Returns null when there is nothing to add.
 *
 * Never throws: memory is an enhancement, and a memory outage must not take
 * chat down with it.
 */
export async function getMemoryContext(
  userId: string,
  message: string,
  options: { limit?: number } = {}
): Promise<string | null> {
  try {
    const facts = await retrieveRelevantFacts(userId, message, options);
    if (facts.length === 0) return null;

    // Track usage so recency scoring means something.
    await markFactsAccessed(facts.map((fact) => fact.id));

    return formatFactsForPrompt(facts);
  } catch (error) {
    console.error('[Memory] Failed to load memory context:', error);
    return null;
  }
}

/** Bump access counters for retrieved facts. Best-effort. */
export async function markFactsAccessed(factIds: string[]): Promise<void> {
  if (factIds.length === 0) return;

  try {
    await prisma.memoryFact.updateMany({
      where: { id: { in: factIds } },
      data: { lastAccessed: new Date(), accessCount: { increment: 1 } },
    });
  } catch (error) {
    console.error('[Memory] Failed to record fact access:', error);
  }
}

const EXTRACTION_PROMPT = `You extract durable facts about a user from a conversation.

Return ONLY a JSON array. No prose, no code fences. Each element must be:
{"factType": one of ${FACT_TYPES.map((t) => `"${t}"`).join(' | ')},
 "content": "one self-contained sentence, written in the third person about the user",
 "confidenceScore": 0.0-1.0,
 "importanceScore": 0.0-1.0}

Rules:
- Only include things that stay true after this conversation ends.
- Exclude anything about the current task, transient state, or the assistant.
- Exclude anything you are not confident the user actually stated or clearly implied.
- Each fact must stand alone without the conversation for context.
- Return [] if there is nothing durable. An empty array is a good answer.
- At most 5 facts.`;

/**
 * Parse the extractor's reply into validated facts.
 *
 * The model is instructed to return bare JSON, but tolerating a code fence
 * costs one regex and removes the most common reason extraction silently
 * yields nothing. Anything malformed yields [] rather than throwing.
 * Exported for testing.
 */
export function parseExtractedFacts(raw: string): ExtractedFact[] {
  if (!raw) return [];

  // Strip a ```json ... ``` wrapper if the model added one.
  const unfenced = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Fall back to the outermost bracketed span if there is surrounding prose.
  const start = unfenced.indexOf('[');
  const end = unfenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const clamp = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : fallback;

  return parsed.flatMap((entry): ExtractedFact[] => {
    if (typeof entry !== 'object' || entry === null) return [];

    const candidate = entry as Record<string, unknown>;
    const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
    if (!content) return [];

    const factType = FACT_TYPES.includes(candidate.factType as FactType)
      ? (candidate.factType as FactType)
      : 'fact';

    return [
      {
        factType,
        content,
        confidenceScore: clamp(candidate.confidenceScore, 0.7),
        importanceScore: clamp(candidate.importanceScore, 0.5),
      },
    ];
  });
}

/** Normalized form used to decide whether two facts are the same fact. */
export function factFingerprint(content: string): string {
  return tokenize(content).sort().join(' ');
}

/**
 * Drop facts already represented in `existing`, and de-duplicate within the batch.
 * Exported for testing.
 */
export function dedupeFacts(
  incoming: ExtractedFact[],
  existing: string[]
): ExtractedFact[] {
  const seen = new Set(existing.map(factFingerprint));

  return incoming.filter((fact) => {
    const fingerprint = factFingerprint(fact.content);
    if (!fingerprint || seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

const MIN_MESSAGES_TO_EXTRACT = 2;
const MIN_CONFIDENCE_TO_STORE = 0.6;

/** Extract every N messages rather than every turn. */
export const EXTRACTION_CADENCE = 6;

/**
 * Decide whether this turn should pay for fact extraction.
 *
 * Next 14 has no `after()`, so extraction runs inline and costs the user
 * latency. Amortizing it over every Nth message keeps the typical turn free
 * while still capturing facts as a conversation develops.
 * Exported for testing.
 */
export function shouldExtractFacts(
  totalMessages: number,
  cadence: number = EXTRACTION_CADENCE
): boolean {
  if (totalMessages < MIN_MESSAGES_TO_EXTRACT) return false;
  return totalMessages % cadence === 0;
}

/**
 * Extract durable facts from a finished exchange and store the new ones.
 *
 * Returns the number of facts written. Never throws — this runs after the user
 * already has their reply, so a failure here must stay invisible to them.
 */
export async function extractAndStoreFacts(params: {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  modelId?: string;
}): Promise<number> {
  const { userId, messages, modelId = 'claude-haiku-4-5-20251001' } = params;

  if (messages.length < MIN_MESSAGES_TO_EXTRACT) return 0;

  try {
    const transcript = messages
      .filter((message) => message.content?.trim())
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n\n');

    if (!transcript) return 0;

    const response = await aiRouter.chat(modelId, {
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: transcript },
      ],
      maxTokens: 1024,
    });

    const extracted = parseExtractedFacts(response.content).filter(
      (fact) => fact.confidenceScore >= MIN_CONFIDENCE_TO_STORE
    );
    if (extracted.length === 0) return 0;

    const existing = await prisma.memoryFact.findMany({
      where: { userId },
      select: { content: true },
      take: 500,
    });

    const fresh = dedupeFacts(
      extracted,
      existing.map((fact) => fact.content)
    );
    if (fresh.length === 0) return 0;

    await prisma.memoryFact.createMany({
      data: fresh.map((fact) => ({
        userId,
        factType: fact.factType,
        content: fact.content,
        confidenceScore: fact.confidenceScore,
        importanceScore: fact.importanceScore,
      })),
    });

    return fresh.length;
  } catch (error) {
    console.error('[Memory] Fact extraction failed:', error);
    return 0;
  }
}
