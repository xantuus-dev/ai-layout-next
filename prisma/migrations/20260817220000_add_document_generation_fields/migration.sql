-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "documentPhase" TEXT,
ADD COLUMN     "documentSpec" JSONB,
ADD COLUMN     "requestedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Task_userId_documentPhase_idx" ON "Task"("userId", "documentPhase");
