-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "ownerId" TEXT;

-- Backfill: an integration is owned by its connecting user's team owner if they
-- bill to one, otherwise by the user themselves.
UPDATE "Integration" i
SET "ownerId" = COALESCE(u."billingOwnerId", i."userId")
FROM "User" u
WHERE u."id" = i."userId" AND i."ownerId" IS NULL;

-- CreateIndex
CREATE INDEX "Integration_ownerId_provider_idx" ON "Integration"("ownerId", "provider");
