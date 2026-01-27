# Autonomous Agent Execution Engine - Design Document

## Overview

This document outlines the design and implementation of a **true autonomous agent system** for Xantuus AI. This will transform the platform from a chat interface with task tracking into a platform where AI agents actually execute tasks autonomously.

---

## Core Architecture

### High-Level Flow

```
User Creates Task
    ↓
Task Queue (Redis/BullMQ)
    ↓
Agent Orchestrator picks up task
    ↓
Agent Planner creates execution plan
    ↓
Agent Executor runs steps in loop:
    - Reason (what to do next)
    - Act (call tool/API)
    - Observe (process result)
    - Repeat until complete
    ↓
Store results & update task status
    ↓
Notify user of completion
```

---

## Component Architecture

### 1. Agent Orchestrator
**Location**: `src/lib/agent/orchestrator.ts`

**Responsibilities**:
- Poll task queue for pending tasks
- Load task context and configuration
- Initialize appropriate agent type
- Handle agent lifecycle (start, pause, resume, stop)
- Manage concurrent agent execution limits
- Track agent metrics and health

### 2. Agent Planner
**Location**: `src/lib/agent/planner.ts`

**Responsibilities**:
- Analyze task description and goal
- Break down into actionable steps
- Identify required tools and capabilities
- Create execution plan with dependencies
- Estimate credit cost and time
- Handle plan refinement based on execution

### 3. Agent Executor (ReAct Loop)
**Location**: `src/lib/agent/executor.ts`

**Responsibilities**:
- Implement ReAct (Reasoning + Acting) pattern
- Execute plan steps sequentially
- Call tools based on AI decisions
- Process tool outputs
- Handle errors and retries
- Maintain agent state between steps
- Record execution trace for debugging

### 4. Tool Registry
**Location**: `src/lib/agent/tools/`

**Available Tools**:
- `browser.ts` - Web scraping and automation (existing Puppeteer)
- `email.ts` - Send emails via Gmail API (existing)
- `calendar.ts` - Calendar management (existing)
- `drive.ts` - Google Drive operations (existing)
- `database.ts` - Query/update database
- `http.ts` - Make HTTP requests to APIs
- `code.ts` - Execute safe code snippets
- `image.ts` - Image generation/manipulation
- `search.ts` - Web search capabilities

### 5. Job Queue System
**Location**: `src/lib/queue/`

**Technology**: BullMQ + Redis (via Upstash for serverless)

**Responsibilities**:
- Persistent task queue
- Retry logic with exponential backoff
- Job prioritization
- Scheduled/cron jobs
- Job progress tracking
- Dead letter queue for failed jobs

---

## Database Schema Changes

### Update Task Model

```prisma
model Task {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Basic info
  title       String
  description String? @db.Text
  status      String  @default("pending") // pending, planning, executing, paused, completed, failed, cancelled
  priority    String  @default("medium") // low, medium, high, urgent

  // Agent configuration
  agentType   String? // "browser_automation", "email_campaign", "data_processing", "research"
  agentModel  String? // Which AI model to use
  agentConfig Json?   // Agent-specific configuration

  // Execution plan
  plan        Json?   // Execution plan from planner
  planTokens  Int     @default(0) // Tokens used for planning
  planCredits Int     @default(0) // Credits used for planning

  // Execution tracking
  attempts       Int       @default(0)
  currentStep    Int       @default(0) // Which step is currently executing
  totalSteps     Int       @default(0) // Total steps in plan
  lastRunAt      DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  failedAt       DateTime?

  // Results and state
  result         Json?     // Final result
  executionTrace Json?     // Full trace of what agent did
  error          String?   @db.Text // Error message if failed

  // Resource usage
  totalTokens    Int       @default(0)
  totalCredits   Int       @default(0)
  executionTime  Int       @default(0) // Milliseconds

  // Metadata
  dueDate     DateTime?
  tags        String[]

  // Relations
  executions  TaskExecution[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([projectId])
  @@index([userId, status])
  @@index([userId, createdAt])
  @@index([status, priority]) // For queue polling
}

// New: Detailed execution log
model TaskExecution {
  id     String @id @default(cuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)

  step        Int    // Which step this execution represents
  action      String // What action was taken
  tool        String? // Which tool was used
  input       Json   // Input to the tool
  output      Json?  // Output from the tool
  reasoning   String? @db.Text // Agent's reasoning for this step

  status      String // "running", "completed", "failed"
  error       String? @db.Text

  tokens      Int    @default(0)
  credits     Int    @default(0)
  duration    Int    @default(0) // Milliseconds

  createdAt DateTime @default(now())
  completedAt DateTime?

  @@index([taskId, step])
  @@index([taskId, createdAt])
}

// New: Agent health and metrics
model AgentMetrics {
  id String @id @default(cuid())

  agentType      String
  tasksCompleted Int    @default(0)
  tasksFailed    Int    @default(0)
  totalTokens    Int    @default(0)
  totalCredits   Int    @default(0)
  avgDuration    Int    @default(0) // Average milliseconds
  successRate    Float  @default(0) // 0-100

  date      DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([agentType, date])
  @@index([agentType])
  @@index([date])
}
```

---

## Implementation Plan

### Phase 1: Core Engine (Week 1)
1. ✅ Create agent type definitions and interfaces
2. ✅ Build basic agent executor with ReAct loop
3. ✅ Implement tool registry and base tools
4. ✅ Add database schema changes
5. ✅ Create simple planner

### Phase 2: Tool Integration (Week 2)
1. ✅ Integrate existing browser control
2. ✅ Integrate Google APIs (email, calendar, drive)
3. ✅ Add HTTP tool for API calls
4. ✅ Add database query tool
5. ✅ Create tool error handling

### Phase 3: Job Queue (Week 3)
1. ✅ Set up Redis (Upstash)
2. ✅ Implement BullMQ queue
3. ✅ Create worker process
4. ✅ Add retry logic
5. ✅ Implement scheduled tasks

### Phase 4: Orchestration (Week 4)
1. ✅ Build agent orchestrator
2. ✅ Add concurrent execution limits
3. ✅ Implement agent state management
4. ✅ Add progress notifications
5. ✅ Create monitoring dashboard

### Phase 5: UI & Testing (Week 5)
1. ✅ Build task creation wizard
2. ✅ Add execution visualization
3. ✅ Create agent logs viewer
4. ✅ Add manual intervention points
5. ✅ End-to-end testing

---

## Agent Types & Use Cases

### 1. Browser Automation Agent
**Type**: `browser_automation`
**Use Cases**:
- Competitor price monitoring
- Data extraction from websites
- Form filling automation
- Screenshot capture
- Web testing

**Example Task**:
```json
{
  "type": "browser_automation",
  "goal": "Check competitor pricing daily and alert if lower than ours",
  "config": {
    "urls": ["competitor1.com/pricing", "competitor2.com/pricing"],
    "selector": ".price",
    "schedule": "0 9 * * *",
    "alertThreshold": 99.99
  }
}
```

### 2. Email Campaign Agent
**Type**: `email_campaign`
**Use Cases**:
- Automated follow-ups
- Newsletter generation
- Lead nurturing sequences
- Invoice reminders
- Customer onboarding

**Example Task**:
```json
{
  "type": "email_campaign",
  "goal": "Send personalized follow-up emails to trial users on day 7",
  "config": {
    "trigger": "trial_day_7",
    "template": "trial_followup",
    "personalization": ["name", "signup_date", "features_used"]
  }
}
```

### 3. Data Processing Agent
**Type**: `data_processing`
**Use Cases**:
- CSV data enrichment
- Report generation
- Data validation
- Format conversion
- Database updates

**Example Task**:
```json
{
  "type": "data_processing",
  "goal": "Enrich lead list with LinkedIn data and save to CRM",
  "config": {
    "input": "leads.csv",
    "enrichment": ["linkedin_profile", "company_size", "title"],
    "output": "crm_database"
  }
}
```

### 4. Research Agent
**Type**: "research"
**Use Cases**:
- Market research
- Competitor analysis
- Content research
- Trend monitoring
- News aggregation

**Example Task**:
```json
{
  "type": "research",
  "goal": "Weekly report on AI automation trends",
  "config": {
    "sources": ["google_news", "reddit", "hackernews"],
    "keywords": ["AI automation", "AI agents", "workflow automation"],
    "format": "markdown_report",
    "schedule": "0 9 * * 1"
  }
}
```

---

## Credit Costs

### Planning Phase
- Simple tasks: 100-500 credits (uses Sonnet)
- Complex tasks: 500-2000 credits (uses Opus for planning)

### Execution Phase (per step)
- Browser action: 10-50 credits
- API call: 5-20 credits
- Email send: 10 credits
- Data processing: 50-200 credits (depends on AI usage)
- Decision/reasoning: 100-500 credits per step

### Example Total Costs
- Simple email automation: 500-1000 credits
- Browser scraping task: 1000-3000 credits
- Complex multi-step workflow: 5000-10000 credits

---

## Monitoring & Observability

### Agent Dashboard Metrics
1. **Active Agents**: Count of currently executing agents
2. **Queue Depth**: Number of pending tasks
3. **Success Rate**: % of tasks completed successfully
4. **Average Duration**: Mean execution time per agent type
5. **Credit Usage**: Credits consumed in last 24h/7d/30d
6. **Error Rate**: % of failed executions

### Execution Trace
Each task stores full execution trace:
```json
{
  "taskId": "task_123",
  "steps": [
    {
      "step": 1,
      "reasoning": "I need to navigate to the competitor's pricing page",
      "action": "browser.navigate",
      "input": { "url": "competitor.com/pricing" },
      "output": { "status": "success", "loadTime": "2.3s" },
      "timestamp": "2026-01-27T10:00:00Z"
    },
    {
      "step": 2,
      "reasoning": "Extract the price from the page",
      "action": "browser.extract",
      "input": { "selector": ".price" },
      "output": { "price": "$99" },
      "timestamp": "2026-01-27T10:00:03Z"
    }
  ]
}
```

---

## Error Handling & Recovery

### Retry Strategy
1. **Transient Errors** (network, timeout): Retry 3x with exponential backoff
2. **Tool Errors** (selector not found): Adapt approach, try alternative
3. **Planning Errors**: Replan with more context
4. **Credit Limit**: Pause and notify user
5. **Fatal Errors**: Mark as failed, send notification

### Human-in-the-Loop
- Agent can request approval before critical actions
- User can pause/resume agent execution
- Manual intervention points in workflow

### Rollback Capability
- Track all changes made (database updates, emails sent)
- Provide rollback for reversible actions
- Warn about non-reversible actions (email sent, payment made)

---

## Security & Safety

### Sandboxing
- Agents run in isolated environments
- Limited access to sensitive data
- Cannot modify critical system settings
- All actions logged and auditable

### Rate Limiting
- Max 10 concurrent agents per user
- Max 100 tool calls per agent
- Timeout: 5 minutes per task
- Circuit breaker for failing tools

### Approval Requirements
- Financial transactions require approval
- Email to >10 recipients requires approval
- Data deletion requires approval
- External API calls with write access require approval

---

## API Endpoints

### Create Task with Agent
```typescript
POST /api/workspace/tasks
{
  "title": "Monitor competitor pricing",
  "description": "Check competitor.com daily and alert if price changes",
  "agentType": "browser_automation",
  "agentConfig": {
    "url": "competitor.com/pricing",
    "selector": ".price",
    "schedule": "0 9 * * *"
  }
}
```

### Start Agent Execution
```typescript
POST /api/agent/execute/{taskId}
{
  "async": true // Run in background
}
```

### Get Execution Status
```typescript
GET /api/agent/status/{taskId}
Response:
{
  "taskId": "task_123",
  "status": "executing",
  "currentStep": 3,
  "totalSteps": 5,
  "progress": 60,
  "executionTime": 45000,
  "creditsUsed": 1200
}
```

### Pause/Resume/Cancel Agent
```typescript
POST /api/agent/{taskId}/pause
POST /api/agent/{taskId}/resume
POST /api/agent/{taskId}/cancel
```

### Get Execution Trace
```typescript
GET /api/agent/{taskId}/trace
Response: Full execution log with reasoning and actions
```

---

## Configuration

### Environment Variables
```env
# Redis for job queue
REDIS_URL=redis://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Agent configuration
AGENT_MAX_CONCURRENT=10
AGENT_TIMEOUT_MS=300000
AGENT_MAX_RETRIES=3
AGENT_DEFAULT_MODEL=claude-sonnet-4-5-20250929

# Worker configuration
WORKER_CONCURRENCY=5
WORKER_POLL_INTERVAL=1000
```

---

## Example: Complete Agent Flow

### User Creates Task
```typescript
// User: "Check top 5 hackernews posts daily and summarize"
const task = await createTask({
  title: "Daily HN Summary",
  agentType: "research",
  agentConfig: {
    sources: ["hackernews"],
    count: 5,
    schedule: "0 9 * * *"
  }
});
```

### Planner Creates Execution Plan
```typescript
{
  "steps": [
    {
      "action": "http.get",
      "description": "Fetch top stories from HN API",
      "tool": "http",
      "params": { "url": "https://hacker-news.firebaseio.com/v0/topstories.json" }
    },
    {
      "action": "http.getBatch",
      "description": "Fetch details for top 5 stories",
      "tool": "http",
      "params": { "ids": "{step1.result.slice(0,5)}" }
    },
    {
      "action": "ai.summarize",
      "description": "Summarize the stories",
      "tool": "ai",
      "params": { "items": "{step2.result}" }
    },
    {
      "action": "email.send",
      "description": "Send summary email",
      "tool": "email",
      "params": {
        "to": "{user.email}",
        "subject": "Your Daily HN Summary",
        "body": "{step3.result}"
      }
    }
  ],
  "estimatedCredits": 500,
  "estimatedDuration": 30000
}
```

### Executor Runs Plan
```typescript
// Step 1: Fetch top stories
const topStories = await tools.http.get(
  "https://hacker-news.firebaseio.com/v0/topstories.json"
);

// Step 2: Get details
const stories = await Promise.all(
  topStories.slice(0, 5).map(id =>
    tools.http.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
  )
);

// Step 3: AI summarization
const summary = await tools.ai.chat({
  model: "claude-sonnet-4-5-20250929",
  messages: [{
    role: "user",
    content: `Summarize these HN stories:\n${JSON.stringify(stories)}`
  }]
});

// Step 4: Send email
await tools.email.send({
  to: user.email,
  subject: "Your Daily HN Summary",
  body: summary.content
});

// Update task status
await updateTask(taskId, {
  status: "completed",
  result: { summary, storiesProcessed: 5 },
  totalCredits: 450
});
```

---

## Next Steps

1. **Review & Approve**: Review this design document
2. **Start Implementation**: I'll create the actual code for each component
3. **Test with Simple Workflow**: Start with one agent type (e.g., email automation)
4. **Iterate & Expand**: Add more agent types and tools
5. **Production Deploy**: Move to production with monitoring

---

Ready to start implementing? I'll create the actual TypeScript code for:
1. Agent type definitions
2. Core executor with ReAct loop
3. Tool registry
4. Planner system
5. Orchestrator

Let me know and I'll begin writing the code!
