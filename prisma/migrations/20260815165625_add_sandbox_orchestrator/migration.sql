-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "haltReason" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "tokenBudget" INTEGER,
ADD COLUMN     "wallClockBudgetMs" INTEGER;

-- CreateTable
CREATE TABLE "WorkspaceSandbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "specHash" TEXT NOT NULL,
    "blobStateKey" TEXT,
    "resumeCount" INTEGER NOT NULL DEFAULT 0,
    "cumulativeBillableSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "destroyedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSandbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxLease" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "wallClockCeilingMs" INTEGER NOT NULL,
    "tokenCeiling" INTEGER NOT NULL,
    "tokensConsumed" INTEGER NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "SandboxLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxUsageEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "leaseId" TEXT,
    "phase" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "instanceSize" TEXT,
    "billableSeconds" INTEGER NOT NULL,
    "internalCost" DOUBLE PRECISION,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSandbox_workspaceId_key" ON "WorkspaceSandbox"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceSandbox_status_idx" ON "WorkspaceSandbox"("status");

-- CreateIndex
CREATE INDEX "SandboxLease_sandboxId_status_idx" ON "SandboxLease"("sandboxId", "status");

-- CreateIndex
CREATE INDEX "SandboxLease_status_heartbeatAt_idx" ON "SandboxLease"("status", "heartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxUsageEvent_idempotencyKey_key" ON "SandboxUsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SandboxUsageEvent_workspaceId_createdAt_idx" ON "SandboxUsageEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SandboxUsageEvent_taskId_idx" ON "SandboxUsageEvent"("taskId");

-- AddForeignKey
ALTER TABLE "WorkspaceSandbox" ADD CONSTRAINT "WorkspaceSandbox_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxLease" ADD CONSTRAINT "SandboxLease_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "WorkspaceSandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxLease" ADD CONSTRAINT "SandboxLease_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxUsageEvent" ADD CONSTRAINT "SandboxUsageEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
