# Migrations

Until now this project had no migration history — the schema was applied with
`prisma db push`, which offers no versioning and no rollback. The `_baseline`
migration in this directory captures the schema as it stood when migrations
were introduced.

## One-time setup for databases that already exist

**Do not run `prisma migrate deploy` against an existing database first.** The
baseline contains `CREATE TABLE` statements for tables that are already there,
so it will fail. Instead, tell Prisma the baseline is already applied.

Run this once per existing environment (production, staging, and any dev
database that already has the schema):

```bash
# 1. Confirm the live database actually matches schema.prisma.
#    Empty output = no drift = safe to baseline.
npx prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 2. Mark the baseline as already applied (creates _prisma_migrations
#    and records the baseline without executing its SQL).
npx prisma migrate resolve --applied <BASELINE_MIGRATION_FOLDER_NAME>
```

If step 1 prints any SQL, the live database has drifted from `schema.prisma`.
Resolve that **before** baselining — either by reconciling the schema to match
reality, or by applying the printed statements. Baselining over real drift
silently bakes in the difference and every later migration will be computed
from a schema that does not match production.

## After baselining

Normal workflow from then on:

```bash
# Author a change: edit schema.prisma, then generate a migration
npx prisma migrate dev --name describe_your_change

# Deploy: handled by .github/workflows/database-migrations.yml,
# or manually with
npx prisma migrate deploy
```

Stop using `prisma db push` on any database that holds real data. It remains
appropriate for throwaway databases only — the CI integration-test job uses it
deliberately, because that database is discarded after every run.

## Why DIRECT_URL

Migrations issue DDL, which does not work reliably through a connection pooler.
`prisma/schema.prisma` therefore declares `directUrl = env("DIRECT_URL")`.
If `DATABASE_URL` points at a pooled endpoint (Supabase `:6543`, Neon
`-pooler`, or any pgBouncer), `DIRECT_URL` must point at the direct one. Where
there is no pooler, set it to the same value as `DATABASE_URL`.

`DIRECT_URL` is required — Prisma errors if it is missing, so it must be set in
every environment including Vercel, not just CI.
