-- CreateTable
CREATE TABLE "GeneratedMusic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'music_v2',
    "lengthMs" INTEGER NOT NULL,
    "instrumental" BOOLEAN NOT NULL DEFAULT false,
    "audioUrl" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedMusic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStyleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "traits" JSONB NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "lastBuiltAtMessageCount" INTEGER NOT NULL DEFAULT 0,
    "lastBuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedMusic_userId_createdAt_idx" ON "GeneratedMusic"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserStyleProfile_userId_key" ON "UserStyleProfile"("userId");

-- CreateIndex
CREATE INDEX "UserStyleProfile_userId_idx" ON "UserStyleProfile"("userId");

-- AddForeignKey
ALTER TABLE "GeneratedMusic" ADD CONSTRAINT "GeneratedMusic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStyleProfile" ADD CONSTRAINT "UserStyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

