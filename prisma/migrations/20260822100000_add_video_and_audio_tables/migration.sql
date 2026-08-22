-- CreateTable
CREATE TABLE "GeneratedVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'veo-3.1-generate-preview',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "durationSeconds" INTEGER NOT NULL DEFAULT 8,
    "videoUrl" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedVideo_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "targetDurationSeconds" INTEGER NOT NULL,
    "scenes" JSONB NOT NULL,
    "finalVideoUrl" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "GeneratedAudio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'eleven_multilingual_v2',
    "voiceId" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "audioUrl" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedAudio_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "GeneratedVideo_userId_createdAt_idx" ON "GeneratedVideo"("userId", "createdAt");
-- CreateIndex
CREATE INDEX "VideoProject_userId_createdAt_idx" ON "VideoProject"("userId", "createdAt");
-- CreateIndex
CREATE INDEX "GeneratedAudio_userId_createdAt_idx" ON "GeneratedAudio"("userId", "createdAt");
-- AddForeignKey
ALTER TABLE "GeneratedVideo" ADD CONSTRAINT "GeneratedVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
