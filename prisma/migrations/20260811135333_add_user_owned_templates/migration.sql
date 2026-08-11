-- PromptTemplate: ownership and visibility, so a template can belong to a user
-- rather than only to the curated gallery.
--
-- Additive only. Both columns take defaults that reproduce today's behaviour on
-- existing rows: userId is NULL (the curated rows stay ownerless) and
-- visibility is 'public' (they stay listed). Nothing reads visibility yet — the
-- gallery query in /api/templates still filters on isPublic — so applying this
-- to a live database changes no current behaviour.

-- AlterTable
ALTER TABLE "PromptTemplate" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

-- CreateIndex
CREATE INDEX "PromptTemplate_userId_updatedAt_idx" ON "PromptTemplate"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
