-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "keyHash" TEXT,
ADD COLUMN     "keyPrefix" TEXT,
ALTER COLUMN "key" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dataRetentionDays" INTEGER,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "AiInteractionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    "redactionTypes" JSONB,
    "zdr" BOOLEAN NOT NULL DEFAULT false,
    "promptHash" TEXT,
    "responseHash" TEXT,
    "entryHash" TEXT NOT NULL,
    "prevHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInteractionLog_userId_createdAt_idx" ON "AiInteractionLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "AiInteractionLog" ADD CONSTRAINT "AiInteractionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
