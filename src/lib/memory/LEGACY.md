# Legacy pgvector memory subsystem — do not use

`MemoryService.ts`, `ConversationIndexer.ts`, `MemoryConsolidator.ts`,
`MemoryScheduler.ts`, `FactExtractor.ts`, `client.ts` and `chat-integration.ts`
are **quarantined**. They have never run against a real database and cannot
work in their current state. Nothing in the app imports them except the four
`/api/memory/*` routes, which inherit the same faults.

The working memory implementation is **`facts.ts`**, wired into
`src/app/api/chat/route.ts`.

## Why this code cannot work

**1. The code queries table names that do not exist.**
The models mostly *do* exist in `prisma/schema.prisma` — `MemoryFile`,
`MemoryChunk`, `MemoryFact`, `UserMemoryMeta`, `IndexedSession`,
`UserIndexingConfig` and `ConsolidationJob` are all defined. The problem is the
**names the raw SQL uses**. There is not a single `@@map` in the schema, so
Prisma creates quoted camelCase tables (`"MemoryFile"`, `"IndexedSession"`, …),
while the TypeScript layer issues unquoted snake_case SQL:

| Code queries | Prisma created |
|---|---|
| `memory_files`, `memory_chunks`, `user_memory_meta` | `"MemoryFile"`, `"MemoryChunk"`, `"UserMemoryMeta"` |
| `indexed_sessions`, `user_indexing_config` | `"IndexedSession"`, `"UserIndexingConfig"` |
| `memory_facts`, `consolidation_jobs` | `"MemoryFact"`, `"ConsolidationJob"` |

Postgres folds unquoted identifiers to lowercase, so `FROM memory_files` looks
for a table literally named `memory_files` and fails against `"MemoryFile"`.
Every write in `MemoryService`, `ConversationIndexer` and `MemoryConsolidator`
is affected. Column names have the same problem (`user_id` vs `"userId"`).

**2. The read path does not match the write path.**
`MemoryService.searchMemory` calls `search_memory_hybrid()`, which correctly
reads `"MemoryChunk"` / `"MemoryFile"`. So reads target the real tables while
writes target names that do not resolve — the read path could only ever return
rows some *other* process had written.

**3. `setup-memory-database.sql` creates no tables.**
It contains zero `CREATE TABLE` statements — only functions, views, indexes,
and `ALTER TABLE … ADD COLUMN embedding_vector vector(1536)`. It assumes the
Prisma tables already exist, which is correct, but it cannot rescue the
snake_case queries.

**4. User IDs are the wrong type.**
The TypeScript layer types `userId: number` in 31 places. Every corresponding
database column is `TEXT` holding a cuid. `fileId` and `factId` have the same
problem — Prisma issues those as cuid strings, the TS layer expects integers.

**5. The bridging code leaks memory across users.**
`chat-integration.ts` and `client.ts` bridged the type gap with:

```ts
const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;
```

This strips non-digits from a cuid and truncates to nine characters, so
distinct users readily collide — and any cuid with no digits maps every user to
`1`. Had the write path worked, this would have been a cross-tenant data leak.
**Never reinstate this pattern.** The same expression is still present in
`src/app/api/memory/search/route.ts` and
`src/app/api/memory/consolidate/route.ts`.

**6. It connects to an undeclared database.**
`config.ts` reads `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`.
The rest of the app uses `DATABASE_URL`, and none of those variables appear in
`.env.example`.

## What it would take to revive it

Rewriting the storage layer (~1,800 lines) so every statement uses the quoted
camelCase tables and columns Prisma actually creates, plus:

- string IDs throughout (`userId`, `fileId`, `factId`)
- the `vector` extension and the `embedding_vector vector(1536)` columns that
  `setup-memory-database.sql` adds by `ALTER TABLE` but Prisma does not declare
  — so they vanish on any `prisma migrate reset`
- a pgvector-capable Postgres in every environment, including CI

The Prisma models themselves are fine and can be kept as-is.

Worth doing only if lexical retrieval in `facts.ts` proves insufficient in
practice. Semantic search is genuinely better than keyword matching; it is not
better than a feature that works.
