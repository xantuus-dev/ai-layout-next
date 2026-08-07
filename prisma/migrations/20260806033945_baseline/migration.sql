-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "revenueCatUserId" TEXT,
    "revenueCatCustomerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "monthlyCredits" INTEGER NOT NULL DEFAULT 1000,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingCycle" TEXT,
    "creditAlert80SentAt" TIMESTAMP(3),
    "creditAlert100SentAt" TIMESTAMP(3),
    "paymentFailed" BOOLEAN NOT NULL DEFAULT false,
    "paymentFailedAt" TIMESTAMP(3),
    "billingOwnerId" TEXT,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "googleDriveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleGmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "nickname" TEXT,
    "occupation" TEXT,
    "bio" TEXT,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.0-flash-exp',
    "width" INTEGER NOT NULL DEFAULT 1024,
    "height" INTEGER NOT NULL DEFAULT 1024,
    "imageUrl" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "defaultWidth" INTEGER NOT NULL DEFAULT 1024,
    "defaultHeight" INTEGER NOT NULL DEFAULT 1024,
    "icon" TEXT,
    "thumbnail" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageGenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "basePrompt" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 3,
    "width" INTEGER NOT NULL DEFAULT 1024,
    "height" INTEGER NOT NULL DEFAULT 1024,
    "totalCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageShareLink" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowShare" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplateCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplateCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT[],
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "requiresGoogleDrive" BOOLEAN NOT NULL DEFAULT false,
    "requiresGmail" BOOLEAN NOT NULL DEFAULT false,
    "requiresCalendar" BOOLEAN NOT NULL DEFAULT false,
    "supportsImageGen" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "agentType" TEXT,
    "agentModel" TEXT,
    "agentConfig" JSONB,
    "plan" JSONB,
    "planTokens" INTEGER NOT NULL DEFAULT 0,
    "planCredits" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "result" JSONB,
    "executionTrace" JSONB,
    "error" TEXT,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "executionTime" INTEGER NOT NULL DEFAULT 0,
    "schedule" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3),
    "timezone" TEXT DEFAULT 'America/New_York',
    "dueDate" TIMESTAMP(3),
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "creditsAwarded" INTEGER NOT NULL DEFAULT 500,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled Conversation',
    "summary" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "folder" TEXT,
    "model" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER,
    "credits" INTEGER,
    "thinkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "parentMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "fileData" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" JSONB,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "tool" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "reasoning" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMetrics" (
    "id" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksFailed" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "avgDuration" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "userAgent" TEXT,
    "viewport" JSONB,
    "cookies" JSONB,
    "localStorage" JSONB,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "navigationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recordingWorkflow" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "totalCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebpageContext" (
    "id" TEXT NOT NULL,
    "browserSessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mainContent" TEXT,
    "structuredData" JSONB,
    "metadata" JSONB,
    "links" JSONB,
    "images" JSONB,
    "contentSummary" TEXT,
    "embeddings" JSONB,
    "expiresAt" TIMESTAMP(3),
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebpageContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "browserSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER,
    "credits" INTEGER,
    "thinkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contextUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "schedule" TEXT,
    "isAIAssisted" BOOLEAN NOT NULL DEFAULT true,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 300,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "successfulRuns" INTEGER NOT NULL DEFAULT 0,
    "failedRuns" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "action" JSONB NOT NULL,
    "onError" TEXT NOT NULL DEFAULT 'stop',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelay" INTEGER NOT NULL DEFAULT 1000,
    "condition" JSONB,
    "skipIfFalse" BOOLEAN NOT NULL DEFAULT false,
    "saveOutput" BOOLEAN NOT NULL DEFAULT false,
    "outputName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "executionTrace" JSONB,
    "aiRecoveries" INTEGER NOT NULL DEFAULT 0,
    "aiRecoveryDetail" JSONB,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "checkType" TEXT NOT NULL DEFAULT 'text',
    "checkInterval" INTEGER NOT NULL DEFAULT 3600,
    "selector" TEXT,
    "aiPrompt" TEXT,
    "alertOnChange" BOOLEAN NOT NULL DEFAULT true,
    "alertChannels" JSONB NOT NULL DEFAULT '[]',
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastValue" TEXT,
    "lastHash" TEXT,
    "totalChecks" INTEGER NOT NULL DEFAULT 0,
    "alertsTriggered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorAlert" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL DEFAULT 'content_changed',
    "oldValue" TEXT,
    "newValue" TEXT,
    "aiAnalysis" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "deliveryChannels" JSONB,
    "oldScreenshot" TEXT,
    "newScreenshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "apiKey" TEXT,
    "webhookUrl" TEXT,
    "config" JSONB,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTool" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "parameters" JSONB NOT NULL,
    "headers" JSONB,
    "authentication" JSONB,
    "responseMapping" JSONB,
    "errorMapping" JSONB,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMemoryMeta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "lastIndexed" TIMESTAMP(3),
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemoryMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'memory',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileHash" TEXT,
    "contentPreview" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryChunk" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "embedding" JSONB,
    "searchVector" TEXT,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddingCache" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorySearchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "vectorScore" DOUBLE PRECISION,
    "textScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "latency" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorySearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIndexingConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoIndexEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minMessagesToIndex" INTEGER NOT NULL DEFAULT 5,
    "indexOnSessionEnd" BOOLEAN NOT NULL DEFAULT true,
    "consolidateOnIndex" BOOLEAN NOT NULL DEFAULT true,
    "consolidationIntervalHours" INTEGER NOT NULL DEFAULT 6,
    "lastConsolidationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIndexingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexedSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "consolidationStatus" TEXT NOT NULL DEFAULT 'pending',
    "factsExtracted" INTEGER NOT NULL DEFAULT 0,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consolidatedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "sourceChunkIds" TEXT[],
    "embedding" JSONB,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'scheduled',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "factsExtracted" INTEGER NOT NULL DEFAULT 0,
    "factsStored" INTEGER NOT NULL DEFAULT 0,
    "factsMerged" INTEGER NOT NULL DEFAULT 0,
    "chunksProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolidationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageImportance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "importanceScore" DOUBLE PRECISION NOT NULL,
    "recencyFactor" DOUBLE PRECISION NOT NULL,
    "accessFactor" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageImportance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomSkill" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricingModel" TEXT NOT NULL DEFAULT 'free',
    "price" INTEGER NOT NULL DEFAULT 0,
    "requiredTools" TEXT[],
    "requiredIntegrations" TEXT[],
    "estimatedCreditCost" INTEGER NOT NULL DEFAULT 0,
    "skillType" TEXT NOT NULL DEFAULT 'config',
    "skillDefinition" JSONB NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "changelog" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "reviewFeedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,
    "monthlyRevenue" INTEGER NOT NULL DEFAULT 0,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillInstallation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "purchaseType" TEXT NOT NULL DEFAULT 'free',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "transactionId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionPeriodEnd" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "unhelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "agentType" TEXT NOT NULL DEFAULT 'custom',
    "systemPrompt" TEXT NOT NULL,
    "suggestedModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    "requiredTools" TEXT[],
    "optionalTools" TEXT[],
    "requiredIntegrations" TEXT[],
    "sampleWorkflows" JSONB NOT NULL DEFAULT '[]',
    "customInstructionsTemplate" TEXT,
    "suggestedKPIs" TEXT[],
    "defaultConfig" JSONB NOT NULL DEFAULT '{}',
    "tier" TEXT NOT NULL DEFAULT 'free',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "customName" TEXT,
    "customSystemPrompt" TEXT,
    "customConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTeam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "teamType" TEXT NOT NULL DEFAULT 'sequential',
    "maxAgents" INTEGER NOT NULL DEFAULT 5,
    "sharedMemory" BOOLEAN NOT NULL DEFAULT true,
    "coordinationStrategy" TEXT NOT NULL DEFAULT 'leader',
    "errorHandling" TEXT NOT NULL DEFAULT 'rollback',
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "successfulTasks" INTEGER NOT NULL DEFAULT 0,
    "failedTasks" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAgent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "agentType" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    "tools" TEXT[],
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "canDelegate" BOOLEAN NOT NULL DEFAULT false,
    "canRequestHelp" BOOLEAN NOT NULL DEFAULT true,
    "maxCreditsPerTask" INTEGER NOT NULL DEFAULT 1000,
    "maxStepsPerTask" INTEGER NOT NULL DEFAULT 20,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCollaboration" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response" TEXT,
    "result" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCollaboration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_revenueCatUserId_key" ON "User"("revenueCatUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "UsageRecord_userId_createdAt_idx" ON "UsageRecord"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "GeneratedImage_userId_createdAt_idx" ON "GeneratedImage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedImage_userId_idx" ON "GeneratedImage"("userId");

-- CreateIndex
CREATE INDEX "GeneratedImage_jobId_idx" ON "GeneratedImage"("jobId");

-- CreateIndex
CREATE INDEX "ImageTemplate_category_isPublic_idx" ON "ImageTemplate"("category", "isPublic");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_userId_status_idx" ON "ImageGenerationJob"("userId", "status");

-- CreateIndex
CREATE INDEX "ImageGenerationJob_status_createdAt_idx" ON "ImageGenerationJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageShareLink_shareToken_key" ON "ImageShareLink"("shareToken");

-- CreateIndex
CREATE INDEX "ImageShareLink_userId_createdAt_idx" ON "ImageShareLink"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageShareLink_shareToken_idx" ON "ImageShareLink"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventId_idx" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplateCategory_name_key" ON "PromptTemplateCategory"("name");

-- CreateIndex
CREATE INDEX "PromptTemplate_categoryId_idx" ON "PromptTemplate"("categoryId");

-- CreateIndex
CREATE INDEX "PromptTemplate_isPublic_isActive_idx" ON "PromptTemplate"("isPublic", "isActive");

-- CreateIndex
CREATE INDEX "PromptTemplate_tier_isActive_idx" ON "PromptTemplate"("tier", "isActive");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_userId_createdAt_idx" ON "Project"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_status_priority_idx" ON "Task"("status", "priority");

-- CreateIndex
CREATE INDEX "Task_scheduleEnabled_nextRunAt_idx" ON "Task"("scheduleEnabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_referredId_idx" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE INDEX "Workspace_userId_isDefault_idx" ON "Workspace"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "Workspace_userId_order_idx" ON "Workspace"("userId", "order");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_idx" ON "Conversation"("workspaceId");

-- CreateIndex
CREATE INDEX "Conversation_userId_lastMessageAt_idx" ON "Conversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_isArchived_idx" ON "Conversation"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "Conversation_userId_folder_idx" ON "Conversation"("userId", "folder");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_email_status_idx" ON "WorkspaceInvite"("email", "status");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_token_idx" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_workspaceId_email_key" ON "WorkspaceInvite"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "TaskExecution_taskId_step_idx" ON "TaskExecution"("taskId", "step");

-- CreateIndex
CREATE INDEX "TaskExecution_taskId_createdAt_idx" ON "TaskExecution"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMetrics_agentType_idx" ON "AgentMetrics"("agentType");

-- CreateIndex
CREATE INDEX "AgentMetrics_date_idx" ON "AgentMetrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMetrics_agentType_date_key" ON "AgentMetrics"("agentType", "date");

-- CreateIndex
CREATE INDEX "BrowserSession_userId_status_idx" ON "BrowserSession"("userId", "status");

-- CreateIndex
CREATE INDEX "BrowserSession_userId_createdAt_idx" ON "BrowserSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WebpageContext_browserSessionId_idx" ON "WebpageContext"("browserSessionId");

-- CreateIndex
CREATE INDEX "WebpageContext_url_idx" ON "WebpageContext"("url");

-- CreateIndex
CREATE INDEX "ChatMessage_browserSessionId_createdAt_idx" ON "ChatMessage"("browserSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Workflow_userId_isActive_idx" ON "Workflow"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Workflow_userId_createdAt_idx" ON "Workflow"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Workflow_isTemplate_idx" ON "Workflow"("isTemplate");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_order_idx" ON "WorkflowStep"("workflowId", "order");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowId_createdAt_idx" ON "WorkflowExecution"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "PageMonitor_userId_isActive_idx" ON "PageMonitor"("userId", "isActive");

-- CreateIndex
CREATE INDEX "PageMonitor_userId_lastCheckedAt_idx" ON "PageMonitor"("userId", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "PageMonitor_isActive_checkInterval_idx" ON "PageMonitor"("isActive", "checkInterval");

-- CreateIndex
CREATE INDEX "MonitorAlert_monitorId_triggeredAt_idx" ON "MonitorAlert"("monitorId", "triggeredAt");

-- CreateIndex
CREATE INDEX "MonitorAlert_delivered_idx" ON "MonitorAlert"("delivered");

-- CreateIndex
CREATE INDEX "Integration_userId_isActive_idx" ON "Integration"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_provider_key" ON "Integration"("userId", "provider");

-- CreateIndex
CREATE INDEX "CustomTool_integrationId_idx" ON "CustomTool"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMemoryMeta_userId_key" ON "UserMemoryMeta"("userId");

-- CreateIndex
CREATE INDEX "UserMemoryMeta_userId_idx" ON "UserMemoryMeta"("userId");

-- CreateIndex
CREATE INDEX "MemoryFile_userId_source_idx" ON "MemoryFile"("userId", "source");

-- CreateIndex
CREATE INDEX "MemoryFile_userId_lastIndexed_idx" ON "MemoryFile"("userId", "lastIndexed");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryFile_userId_filePath_key" ON "MemoryFile"("userId", "filePath");

-- CreateIndex
CREATE INDEX "MemoryChunk_fileId_idx" ON "MemoryChunk"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryChunk_chunkId_key" ON "MemoryChunk"("chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingCache_contentHash_key" ON "EmbeddingCache"("contentHash");

-- CreateIndex
CREATE INDEX "EmbeddingCache_model_contentHash_idx" ON "EmbeddingCache"("model", "contentHash");

-- CreateIndex
CREATE INDEX "EmbeddingCache_lastAccessed_idx" ON "EmbeddingCache"("lastAccessed");

-- CreateIndex
CREATE INDEX "MemorySearchLog_userId_createdAt_idx" ON "MemorySearchLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIndexingConfig_userId_key" ON "UserIndexingConfig"("userId");

-- CreateIndex
CREATE INDEX "UserIndexingConfig_userId_idx" ON "UserIndexingConfig"("userId");

-- CreateIndex
CREATE INDEX "IndexedSession_userId_consolidationStatus_idx" ON "IndexedSession"("userId", "consolidationStatus");

-- CreateIndex
CREATE INDEX "IndexedSession_consolidationStatus_indexedAt_idx" ON "IndexedSession"("consolidationStatus", "indexedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IndexedSession_userId_sessionId_key" ON "IndexedSession"("userId", "sessionId");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_factType_idx" ON "MemoryFact"("userId", "factType");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_importanceScore_idx" ON "MemoryFact"("userId", "importanceScore");

-- CreateIndex
CREATE INDEX "MemoryFact_expiresAt_idx" ON "MemoryFact"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsolidationJob_userId_status_idx" ON "ConsolidationJob"("userId", "status");

-- CreateIndex
CREATE INDEX "ConsolidationJob_status_createdAt_idx" ON "ConsolidationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageImportance_userId_importanceScore_idx" ON "MessageImportance"("userId", "importanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "MessageImportance_userId_chunkId_key" ON "MessageImportance"("userId", "chunkId");

-- CreateIndex
CREATE INDEX "CustomSkill_creatorId_status_idx" ON "CustomSkill"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CustomSkill_status_featured_idx" ON "CustomSkill"("status", "featured");

-- CreateIndex
CREATE INDEX "CustomSkill_category_status_idx" ON "CustomSkill"("category", "status");

-- CreateIndex
CREATE INDEX "CustomSkill_pricingModel_status_idx" ON "CustomSkill"("pricingModel", "status");

-- CreateIndex
CREATE INDEX "SkillInstallation_userId_isActive_idx" ON "SkillInstallation"("userId", "isActive");

-- CreateIndex
CREATE INDEX "SkillInstallation_skillId_installedAt_idx" ON "SkillInstallation"("skillId", "installedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillInstallation_userId_skillId_key" ON "SkillInstallation"("userId", "skillId");

-- CreateIndex
CREATE INDEX "SkillReview_skillId_rating_idx" ON "SkillReview"("skillId", "rating");

-- CreateIndex
CREATE INDEX "SkillReview_skillId_createdAt_idx" ON "SkillReview"("skillId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillReview_userId_skillId_key" ON "SkillReview"("userId", "skillId");

-- CreateIndex
CREATE INDEX "IndustryTemplate_industry_tier_idx" ON "IndustryTemplate"("industry", "tier");

-- CreateIndex
CREATE INDEX "IndustryTemplate_featured_order_idx" ON "IndustryTemplate"("featured", "order");

-- CreateIndex
CREATE INDEX "IndustryTemplate_tier_idx" ON "IndustryTemplate"("tier");

-- CreateIndex
CREATE INDEX "TemplateSetting_userId_isActive_idx" ON "TemplateSetting"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSetting_userId_templateId_key" ON "TemplateSetting"("userId", "templateId");

-- CreateIndex
CREATE INDEX "AgentTeam_userId_teamType_idx" ON "AgentTeam"("userId", "teamType");

-- CreateIndex
CREATE INDEX "TeamAgent_teamId_order_idx" ON "TeamAgent"("teamId", "order");

-- CreateIndex
CREATE INDEX "TeamAgent_teamId_isLeader_idx" ON "TeamAgent"("teamId", "isLeader");

-- CreateIndex
CREATE INDEX "AgentCollaboration_teamId_taskId_idx" ON "AgentCollaboration"("teamId", "taskId");

-- CreateIndex
CREATE INDEX "AgentCollaboration_taskId_status_idx" ON "AgentCollaboration"("taskId", "status");

-- CreateIndex
CREATE INDEX "AgentCollaboration_fromAgentId_toAgentId_idx" ON "AgentCollaboration"("fromAgentId", "toAgentId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_billingOwnerId_fkey" FOREIGN KEY ("billingOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImageGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationJob" ADD CONSTRAINT "ImageGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageShareLink" ADD CONSTRAINT "ImageShareLink_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageShareLink" ADD CONSTRAINT "ImageShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PromptTemplateCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebpageContext" ADD CONSTRAINT "WebpageContext_browserSessionId_fkey" FOREIGN KEY ("browserSessionId") REFERENCES "BrowserSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_browserSessionId_fkey" FOREIGN KEY ("browserSessionId") REFERENCES "BrowserSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageMonitor" ADD CONSTRAINT "PageMonitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "PageMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTool" ADD CONSTRAINT "CustomTool_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemoryMeta" ADD CONSTRAINT "UserMemoryMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFile" ADD CONSTRAINT "MemoryFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryChunk" ADD CONSTRAINT "MemoryChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MemoryFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySearchLog" ADD CONSTRAINT "MemorySearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIndexingConfig" ADD CONSTRAINT "UserIndexingConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexedSession" ADD CONSTRAINT "IndexedSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationJob" ADD CONSTRAINT "ConsolidationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageImportance" ADD CONSTRAINT "MessageImportance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomSkill" ADD CONSTRAINT "CustomSkill_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillInstallation" ADD CONSTRAINT "SkillInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillInstallation" ADD CONSTRAINT "SkillInstallation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "CustomSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "CustomSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSetting" ADD CONSTRAINT "TemplateSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IndustryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAgent" ADD CONSTRAINT "TeamAgent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCollaboration" ADD CONSTRAINT "AgentCollaboration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

