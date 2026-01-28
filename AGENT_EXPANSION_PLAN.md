# AI Agent Platform Expansion Plan

## Executive Summary

**Good News**: Your codebase already has **75% of the requested functionality** implemented! This is not a rebuild - it's a connection and expansion project.

**Current State**:
- ✅ Browser automation infrastructure (Puppeteer with security hardening)
- ✅ Email management (Gmail client with OAuth)
- ✅ Calendar integration (Google Calendar client)
- ✅ Document management (Google Drive + Sheets + Docs)
- ✅ Agent execution engine (ReAct pattern with planning)
- ✅ Workflow system (pre-built automation workflows)
- ⚠️ Terminal execution (not implemented - needs security design)
- ⚠️ Script management (not implemented)

**What's Missing**: The agent tools are **not connected** to the service clients. Think of it like having a car engine (services) and a steering wheel (tools), but the steering column isn't attached yet.

---

## Phase 1: Connect Existing Components (Week 1)

### Priority: CRITICAL | Effort: 10-15 hours | Impact: HIGH

### 1.1 Connect Browser Tools to Browser Control Service

**Current Gap**: Browser tools return placeholder data instead of using the actual Puppeteer integration.

**Files to Modify**:
- `/src/lib/agent/tools/browser.ts` (5 tools)
- `/src/lib/browser-control.ts` (already complete)

**Implementation**:

```typescript
// BEFORE (Current - Placeholder)
export class BrowserNavigateTool implements AgentTool {
  async execute(params: any, context: AgentContext) {
    return {
      success: true,
      data: { message: "Browser navigation simulated" } // ❌ Fake
    };
  }
}

// AFTER (Target - Real Integration)
export class BrowserNavigateTool implements AgentTool {
  async execute(params: any, context: AgentContext) {
    const session = await browserControl.createSession(context.userId);

    try {
      const result = await browserControl.executeAction(session.id, {
        action: 'navigate',
        url: params.url,
      });

      return {
        success: true,
        data: result,
      };
    } finally {
      await browserControl.closeSession(session.id);
    }
  }
}
```

**Tools to Connect**:
1. `BrowserNavigateTool` → `browserControl.executeAction('navigate')`
2. `BrowserExtractTool` → `browserControl.executeAction('extractText')`
3. `BrowserClickTool` → `browserControl.executeAction('click')`
4. `BrowserScreenshotTool` → `browserControl.executeAction('screenshot')`
5. `BrowserWaitForTool` → `browserControl.executeAction('waitForElement')`

**Credit Costs** (already defined):
- Navigate: 25 credits
- Extract: 15 credits
- Click: 10 credits
- Screenshot: 20 credits
- Wait: 5 credits

**Testing**:
```bash
# Test browser automation
curl -X POST http://localhost:3010/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Visit example.com and extract the main heading",
    "agentType": "browser_automation"
  }'
```

**Estimated Time**: 3-4 hours

---

### 1.2 Connect Email Tools to Gmail Client

**Current Gap**: Email tools check for Gmail connection but don't actually send emails.

**Files to Modify**:
- `/src/lib/agent/tools/email.ts` (2 tools)
- `/src/lib/google-gmail.ts` (already complete)

**Implementation**:

```typescript
// BEFORE (Current - Placeholder)
export class EmailSendTool implements AgentTool {
  async execute(params: any, context: AgentContext) {
    const user = await context.db.user.findUnique({
      where: { id: context.userId },
    });

    if (!user?.googleGmailEnabled) {
      throw new Error('Gmail not connected');
    }

    // TODO: Actually send email using Gmail client
    return {
      success: true,
      data: { messageId: 'simulated' } // ❌ Fake
    };
  }
}

// AFTER (Target - Real Integration)
export class EmailSendTool implements AgentTool {
  async execute(params: any, context: AgentContext) {
    const user = await context.db.user.findUnique({
      where: { id: context.userId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleGmailEnabled: true,
      },
    });

    if (!user?.googleGmailEnabled) {
      throw new Error('Gmail not connected. Go to /settings/integrations to connect.');
    }

    // ✅ Real Gmail integration
    const gmail = new GoogleGmailClient(
      user.googleAccessToken!,
      user.googleRefreshToken!
    );

    const messageId = await gmail.sendEmail({
      to: params.to,
      subject: params.subject,
      body: params.body,
      cc: params.cc,
      bcc: params.bcc,
      attachments: params.attachments,
    });

    return {
      success: true,
      data: { messageId },
    };
  }
}
```

**Tools to Connect**:
1. `EmailSendTool` → `gmail.sendEmail()`
2. `EmailSendBatchTool` → `gmail.sendEmail()` with rate limiting

**Testing**:
```bash
# Test email sending
curl -X POST http://localhost:3010/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Send an email to test@example.com with subject Test",
    "agentType": "email_campaign"
  }'
```

**Estimated Time**: 1-2 hours

---

### 1.3 Create Google Drive Tools

**Current Gap**: Drive client exists, but no agent tools to use it.

**New Files to Create**:
- `/src/lib/agent/tools/drive.ts` (6 new tools)

**Tools to Implement**:

```typescript
// 1. Upload File Tool
export class DriveUploadTool implements AgentTool {
  name = 'drive.upload';
  description = 'Upload a file to Google Drive';
  category = 'integration' as const;

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(
      user.googleAccessToken!,
      user.googleRefreshToken!
    );

    const file = await drive.uploadFile({
      name: params.fileName,
      content: params.content,
      mimeType: params.mimeType,
      folderId: params.folderId,
    });

    return { success: true, data: { fileId: file.id, url: file.webViewLink } };
  }
}

// 2. List Files Tool
export class DriveListTool implements AgentTool {
  name = 'drive.list';
  description = 'List files in Google Drive';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(...);

    const files = await drive.listFiles({
      query: params.query,
      maxResults: params.maxResults || 10,
    });

    return { success: true, data: { files } };
  }
}

// 3. Create Google Doc Tool
export class DriveCreateDocTool implements AgentTool {
  name = 'drive.createDoc';
  description = 'Create a new Google Doc';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(...);

    const doc = await drive.createGoogleDoc(params.title, params.content);

    return { success: true, data: { docId: doc.id, url: doc.webViewLink } };
  }
}

// 4. Create Google Sheet Tool
export class DriveCreateSheetTool implements AgentTool {
  name = 'drive.createSheet';
  description = 'Create a new Google Sheet';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(...);

    const sheet = await drive.createGoogleSheet(params.title);

    return { success: true, data: { sheetId: sheet.id, url: sheet.webViewLink } };
  }
}

// 5. Download File Tool
export class DriveDownloadTool implements AgentTool {
  name = 'drive.download';
  description = 'Download a file from Google Drive';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(...);

    const content = await drive.downloadFile(params.fileId);

    return { success: true, data: { content } };
  }
}

// 6. Share File Tool
export class DriveShareTool implements AgentTool {
  name = 'drive.share';
  description = 'Share a Google Drive file with someone';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithDrive(context.userId, context.db);
    const drive = new GoogleDriveClient(...);

    await drive.shareFile(params.fileId, params.email, params.role || 'reader');

    return { success: true, data: { shared: true } };
  }
}
```

**Register Tools**:
```typescript
// In /src/lib/agent/tools/registry.ts
import { DriveUploadTool, DriveListTool, ... } from './drive';

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // ... existing tools ...

  // Drive tools
  registry.register(new DriveUploadTool());
  registry.register(new DriveListTool());
  registry.register(new DriveCreateDocTool());
  registry.register(new DriveCreateSheetTool());
  registry.register(new DriveDownloadTool());
  registry.register(new DriveShareTool());

  return registry;
}
```

**Estimated Time**: 3-4 hours

---

### 1.4 Create Google Calendar Tools

**Current Gap**: Calendar client exists, but no agent tools to use it.

**New Files to Create**:
- `/src/lib/agent/tools/calendar.ts` (4 new tools)

**Tools to Implement**:

```typescript
// 1. Create Event Tool
export class CalendarCreateEventTool implements AgentTool {
  name = 'calendar.createEvent';
  description = 'Create a new calendar event';
  category = 'integration' as const;

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithCalendar(context.userId, context.db);
    const calendar = new GoogleCalendarClient(
      user.googleAccessToken!,
      user.googleRefreshToken!
    );

    const event = await calendar.createEvent({
      summary: params.title,
      description: params.description,
      start: params.startTime,
      end: params.endTime,
      attendees: params.attendees,
      location: params.location,
      timezone: params.timezone || 'America/New_York',
    });

    return {
      success: true,
      data: {
        eventId: event.id,
        htmlLink: event.htmlLink
      }
    };
  }

  estimateCost(params: any): number {
    return 20; // Credits to create an event
  }
}

// 2. List Events Tool
export class CalendarListEventsTool implements AgentTool {
  name = 'calendar.listEvents';
  description = 'List upcoming calendar events';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithCalendar(context.userId, context.db);
    const calendar = new GoogleCalendarClient(...);

    const events = await calendar.listEvents({
      maxResults: params.maxResults || 10,
      timeMin: params.startDate || new Date().toISOString(),
      timeMax: params.endDate,
    });

    return { success: true, data: { events } };
  }

  estimateCost(): number {
    return 10;
  }
}

// 3. Update Event Tool
export class CalendarUpdateEventTool implements AgentTool {
  name = 'calendar.updateEvent';
  description = 'Update an existing calendar event';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithCalendar(context.userId, context.db);
    const calendar = new GoogleCalendarClient(...);

    const event = await calendar.updateEvent(params.eventId, {
      summary: params.title,
      description: params.description,
      start: params.startTime,
      end: params.endTime,
    });

    return { success: true, data: { eventId: event.id } };
  }
}

// 4. Delete Event Tool
export class CalendarDeleteEventTool implements AgentTool {
  name = 'calendar.deleteEvent';
  description = 'Delete a calendar event';

  async execute(params: any, context: AgentContext) {
    const user = await getUserWithCalendar(context.userId, context.db);
    const calendar = new GoogleCalendarClient(...);

    await calendar.deleteEvent(params.eventId);

    return { success: true, data: { deleted: true } };
  }
}
```

**Testing**:
```bash
# Test calendar integration
curl -X POST http://localhost:3010/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Create a meeting tomorrow at 2pm titled Team Sync",
    "agentType": "calendar_manager"
  }'
```

**Estimated Time**: 2-3 hours

---

### 1.5 Update Tool Registry

**File**: `/src/lib/agent/tools/registry.ts`

**Add All New Tools**:

```typescript
import {
  DriveUploadTool,
  DriveListTool,
  DriveCreateDocTool,
  DriveCreateSheetTool,
  DriveDownloadTool,
  DriveShareTool
} from './drive';

import {
  CalendarCreateEventTool,
  CalendarListEventsTool,
  CalendarUpdateEventTool,
  CalendarDeleteEventTool
} from './calendar';

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Browser tools (connect to real browser)
  registry.register(new BrowserNavigateTool());
  registry.register(new BrowserExtractTool());
  registry.register(new BrowserClickTool());
  registry.register(new BrowserScreenshotTool());
  registry.register(new BrowserWaitForTool());

  // Email tools (connect to Gmail)
  registry.register(new EmailSendTool());
  registry.register(new EmailSendBatchTool());

  // HTTP tools (already working)
  registry.register(new HttpGetTool());
  registry.register(new HttpPostTool());

  // AI tools (already working)
  registry.register(new AIChatTool());
  registry.register(new AISummarizeTool());
  registry.register(new AIExtractTool());

  // NEW: Drive tools
  registry.register(new DriveUploadTool());
  registry.register(new DriveListTool());
  registry.register(new DriveCreateDocTool());
  registry.register(new DriveCreateSheetTool());
  registry.register(new DriveDownloadTool());
  registry.register(new DriveShareTool());

  // NEW: Calendar tools
  registry.register(new CalendarCreateEventTool());
  registry.register(new CalendarListEventsTool());
  registry.register(new CalendarUpdateEventTool());
  registry.register(new CalendarDeleteEventTool());

  return registry;
}
```

**Estimated Time**: 30 minutes

---

## Phase 2: Terminal Execution & Script Management (Week 2)

### Priority: HIGH | Effort: 20-25 hours | Impact: HIGH

### 2.1 Design Security Architecture

**Challenge**: Running terminal commands is inherently dangerous. We need multiple layers of security.

**Security Layers**:

1. **Sandboxing**: Isolate command execution from main app
2. **Whitelisting**: Only allow approved commands
3. **Input Validation**: Prevent command injection
4. **Resource Limits**: CPU, memory, time, network
5. **Audit Logging**: Track every command execution

**Architecture Options**:

#### Option A: Docker Container Execution (Recommended)

**Pros**:
- Complete isolation from host system
- Resource limits (CPU, RAM, network)
- Can be killed/reset easily
- Works in production (Fargate, Cloud Run)

**Cons**:
- Requires Docker daemon
- Slower than native execution
- More complex setup

**Implementation**:
```typescript
// /src/lib/terminal-control.ts
import Docker from 'dockerode';

export class TerminalControl {
  private docker: Docker;

  async executeCommand(userId: string, command: string, options: {
    timeout?: number;
    workingDir?: string;
    env?: Record<string, string>;
  }) {
    // 1. Validate command against whitelist
    this.validateCommand(command);

    // 2. Create isolated container
    const container = await this.docker.createContainer({
      Image: 'node:18-alpine', // Minimal base image
      Cmd: ['sh', '-c', command],
      WorkingDir: options.workingDir || '/workspace',
      Env: this.sanitizeEnv(options.env),
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB limit
        NanoCpus: 1000000000, // 1 CPU core
        NetworkMode: 'none', // No network access
        ReadonlyRootfs: true, // Read-only filesystem
      },
      AttachStdout: true,
      AttachStderr: true,
    });

    // 3. Start container with timeout
    await container.start();

    const timeoutHandle = setTimeout(async () => {
      await container.kill();
    }, options.timeout || 30000);

    // 4. Capture output
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    // 5. Wait for completion
    await container.wait();
    clearTimeout(timeoutHandle);

    // 6. Cleanup
    await container.remove();

    // 7. Log execution
    await this.logExecution(userId, command, output);

    return output;
  }

  private validateCommand(command: string) {
    const whitelist = [
      // File operations
      'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find',
      // Text processing
      'sed', 'awk', 'cut', 'sort', 'uniq',
      // Package managers
      'npm', 'yarn', 'pip', 'go',
      // Version control
      'git',
      // Scripting
      'node', 'python', 'python3', 'bash', 'sh',
    ];

    const commandName = command.split(' ')[0];

    if (!whitelist.includes(commandName)) {
      throw new Error(`Command "${commandName}" is not allowed`);
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // Delete root
      />\s*\/dev\/sda/, // Write to disk
      /curl.*\|\s*bash/, // Pipe to bash
      /wget.*\|\s*sh/, // Pipe to shell
      /fork\s*\(\)/, // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error('Command contains dangerous pattern');
      }
    }
  }
}
```

#### Option B: AWS Lambda / Serverless Function (For Production)

**Pros**:
- Built-in isolation and scaling
- Automatic cleanup after execution
- Pay per execution
- No Docker management

**Cons**:
- Limited execution time (15 min Lambda max)
- Cold start latency
- More expensive for frequent use

**Implementation**:
```typescript
// /src/lib/terminal-lambda.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export class TerminalLambda {
  private lambda: LambdaClient;

  async executeCommand(userId: string, command: string) {
    const response = await this.lambda.send(new InvokeCommand({
      FunctionName: 'terminal-executor',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        command,
        userId,
        timeout: 30000,
      }),
    }));

    return JSON.parse(new TextDecoder().decode(response.Payload));
  }
}

// Lambda function code (separate deployment)
// /lambda/terminal-executor/index.js
exports.handler = async (event) => {
  const { command, userId } = event;

  // Execute in isolated Lambda environment
  const { exec } = require('child_process');

  return new Promise((resolve) => {
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout,
        stderr,
        error: error?.message,
      });
    });
  });
};
```

#### Option C: VM2 Sandboxing (Simplest, Less Secure)

**Pros**:
- No external dependencies
- Fast execution
- Easy to implement

**Cons**:
- Less secure than Docker/Lambda
- Can potentially be escaped
- Same process as main app

**Implementation**:
```typescript
// /src/lib/terminal-vm2.ts
import { NodeVM } from 'vm2';

export class TerminalVM {
  async executeScript(userId: string, code: string) {
    const vm = new NodeVM({
      timeout: 30000,
      sandbox: {
        console: {
          log: (...args: any[]) => this.captureLog(userId, args),
        },
      },
      require: {
        external: true,
        builtin: ['fs', 'path', 'crypto'],
        root: './sandbox',
      },
    });

    try {
      const result = vm.run(code);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

**Recommendation**: Start with **Option A (Docker)** for development, migrate to **Option B (Lambda)** for production.

**Estimated Time**: 8-10 hours

---

### 2.2 Implement Terminal Tool

**New File**: `/src/lib/agent/tools/terminal.ts`

```typescript
import { AgentTool, AgentContext, ToolResult } from '../types';
import { TerminalControl } from '@/lib/terminal-control';

export class TerminalExecuteTool implements AgentTool {
  name = 'terminal.execute';
  description = 'Execute a terminal command in a sandboxed environment. Use for file operations, running scripts, or executing programs.';
  category = 'utility' as const;

  private terminal: TerminalControl;

  constructor() {
    this.terminal = new TerminalControl();
  }

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.command || typeof params.command !== 'string') {
      return { valid: false, error: 'command is required and must be a string' };
    }

    if (params.command.length > 1000) {
      return { valid: false, error: 'command is too long (max 1000 characters)' };
    }

    return { valid: true };
  }

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const { command, workingDir, env, timeout } = params;

    try {
      const output = await this.terminal.executeCommand(context.userId, command, {
        workingDir,
        env,
        timeout: timeout || 30000,
      });

      return {
        success: true,
        data: {
          output,
          exitCode: 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: {
          output: error.output || '',
          exitCode: error.exitCode || 1,
        },
      };
    }
  }

  estimateCost(params: any): number {
    // Terminal execution is expensive due to resource usage
    return 50; // 50 credits per command
  }
}

// Register in registry
import { TerminalExecuteTool } from './terminal';

registry.register(new TerminalExecuteTool());
```

**Example Usage**:

```typescript
// Agent can now execute commands
const result = await agentExecutor.execute({
  goal: "List all TypeScript files in the src directory",
  agentType: "terminal",
});

// Agent plans:
// Step 1: Use terminal.execute with command "find src -name '*.ts'"
// Step 2: Use ai.summarize to count and categorize files
```

**Estimated Time**: 6-8 hours

---

### 2.3 Implement Script Management Tools

**New File**: `/src/lib/agent/tools/script.ts`

```typescript
export class ScriptCreateTool implements AgentTool {
  name = 'script.create';
  description = 'Create a new script file (JavaScript, Python, Bash, etc.)';
  category = 'utility' as const;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const { fileName, content, language, description } = params;

    // Save script to database
    const script = await context.db.script.create({
      data: {
        userId: context.userId,
        name: fileName,
        content,
        language,
        description,
        createdAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        scriptId: script.id,
        fileName: script.name,
      },
    };
  }

  estimateCost(): number {
    return 10;
  }
}

export class ScriptExecuteTool implements AgentTool {
  name = 'script.execute';
  description = 'Execute a saved script by ID or inline code';
  category = 'utility' as const;

  private terminal: TerminalControl;

  constructor() {
    this.terminal = new TerminalControl();
  }

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    let code: string;
    let language: string;

    if (params.scriptId) {
      // Execute saved script
      const script = await context.db.script.findUnique({
        where: { id: params.scriptId, userId: context.userId },
      });

      if (!script) {
        return { success: false, error: 'Script not found' };
      }

      code = script.content;
      language = script.language;
    } else {
      // Execute inline code
      code = params.code;
      language = params.language || 'javascript';
    }

    // Execute based on language
    let command: string;

    switch (language) {
      case 'javascript':
      case 'js':
        command = `node -e "${code.replace(/"/g, '\\"')}"`;
        break;
      case 'python':
      case 'python3':
        command = `python3 -c "${code.replace(/"/g, '\\"')}"`;
        break;
      case 'bash':
      case 'sh':
        command = code;
        break;
      default:
        return { success: false, error: `Unsupported language: ${language}` };
    }

    const output = await this.terminal.executeCommand(context.userId, command, {
      timeout: params.timeout || 30000,
    });

    // Log execution
    await context.db.scriptExecution.create({
      data: {
        userId: context.userId,
        scriptId: params.scriptId,
        code,
        language,
        output,
        exitCode: 0,
        duration: 0, // TODO: track duration
        creditsUsed: 50,
        createdAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        output,
        exitCode: 0,
      },
    };
  }

  estimateCost(): number {
    return 50; // Same as terminal.execute
  }
}

export class ScriptListTool implements AgentTool {
  name = 'script.list';
  description = 'List all saved scripts';

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const scripts = await context.db.script.findMany({
      where: { userId: context.userId },
      select: {
        id: true,
        name: true,
        language: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit || 10,
    });

    return {
      success: true,
      data: { scripts },
    };
  }
}
```

**Database Schema Addition** (add to `prisma/schema.prisma`):

```prisma
model Script {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  description String?
  content     String   @db.Text
  language    String   // javascript, python, bash, etc.

  executions  ScriptExecution[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}

model ScriptExecution {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  scriptId    String?
  script      Script?  @relation(fields: [scriptId], references: [id], onDelete: SetNull)

  code        String   @db.Text
  language    String
  output      String   @db.Text
  exitCode    Int
  error       String?  @db.Text

  duration    Int      // milliseconds
  creditsUsed Int

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([scriptId])
}

// Add to User model
model User {
  // ... existing fields ...
  scripts          Script[]
  scriptExecutions ScriptExecution[]
}
```

**Estimated Time**: 6-8 hours

---

## Phase 3: Microsoft Office Integration (Week 3)

### Priority: MEDIUM | Effort: 15-20 hours | Impact: MEDIUM

### 3.1 Add Microsoft Graph OAuth

**Challenge**: Your app already has Google OAuth. Need to add Microsoft OAuth for Office 365 access.

**Files to Create**:
- `/src/lib/microsoft-oauth.ts`
- `/src/app/api/integrations/microsoft/connect/route.ts`
- `/src/app/api/integrations/microsoft/callback/route.ts`

**Implementation**:

```typescript
// /src/lib/microsoft-oauth.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

export class MicrosoftOAuthClient {
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
  }

  getAuthUrl(redirectUri: string, scopes: string[]) {
    return this.msalClient.getAuthCodeUrl({
      redirectUri,
      scopes,
      responseMode: 'query',
    });
  }

  async exchangeCodeForToken(code: string, redirectUri: string, scopes: string[]) {
    const response = await this.msalClient.acquireTokenByCode({
      code,
      redirectUri,
      scopes,
    });

    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || '',
      expiresAt: new Date(Date.now() + response.expiresIn! * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string, scopes: string[]) {
    const response = await this.msalClient.acquireTokenByRefreshToken({
      refreshToken,
      scopes,
    });

    return {
      accessToken: response.accessToken,
      expiresAt: new Date(Date.now() + response.expiresIn! * 1000),
    };
  }
}

// OAuth scopes
export const MICROSOFT_SCOPES = {
  email: 'https://graph.microsoft.com/Mail.ReadWrite',
  calendar: 'https://graph.microsoft.com/Calendars.ReadWrite',
  files: 'https://graph.microsoft.com/Files.ReadWrite.All',
  contacts: 'https://graph.microsoft.com/Contacts.ReadWrite',
  oneDrive: 'https://graph.microsoft.com/Files.ReadWrite.All',
  word: 'https://graph.microsoft.com/Files.ReadWrite.All',
  excel: 'https://graph.microsoft.com/Files.ReadWrite.All',
  powerpoint: 'https://graph.microsoft.com/Files.ReadWrite.All',
};
```

**Database Schema Update**:

```prisma
model User {
  // ... existing Google fields ...

  // Microsoft OAuth
  microsoftAccessToken   String?  @db.Text
  microsoftRefreshToken  String?  @db.Text
  microsoftTokenExpiry   DateTime?

  // Microsoft service toggles
  microsoftEmailEnabled      Boolean @default(false)
  microsoftCalendarEnabled   Boolean @default(false)
  microsoftOneDriveEnabled   Boolean @default(false)
  microsoftOfficeEnabled     Boolean @default(false)
}
```

**Estimated Time**: 4-5 hours

---

### 3.2 Create Microsoft Graph API Clients

**Files to Create**:
- `/src/lib/microsoft-email.ts` (Outlook)
- `/src/lib/microsoft-calendar.ts` (Outlook Calendar)
- `/src/lib/microsoft-onedrive.ts` (OneDrive)
- `/src/lib/microsoft-office.ts` (Word, Excel, PowerPoint)

**Example - Microsoft Email Client**:

```typescript
// /src/lib/microsoft-email.ts
import { Client } from '@microsoft/microsoft-graph-client';

export class MicrosoftEmailClient {
  private client: Client;

  constructor(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  async sendEmail(params: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{ name: string; content: string; mimeType: string }>;
  }) {
    const message = {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.body,
      },
      toRecipients: params.to.map(email => ({
        emailAddress: { address: email },
      })),
      ccRecipients: params.cc?.map(email => ({
        emailAddress: { address: email },
      })),
      bccRecipients: params.bcc?.map(email => ({
        emailAddress: { address: email },
      })),
      attachments: params.attachments?.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.mimeType,
        contentBytes: att.content,
      })),
    };

    const result = await this.client
      .api('/me/sendMail')
      .post({ message });

    return result;
  }

  async listMessages(params: {
    maxResults?: number;
    query?: string;
  }) {
    let request = this.client.api('/me/messages').top(params.maxResults || 10);

    if (params.query) {
      request = request.filter(params.query);
    }

    const result = await request.get();
    return result.value;
  }
}
```

**Example - Microsoft OneDrive Client**:

```typescript
// /src/lib/microsoft-onedrive.ts
import { Client } from '@microsoft/microsoft-graph-client';

export class MicrosoftOneDriveClient {
  private client: Client;

  constructor(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  async uploadFile(params: {
    name: string;
    content: Buffer | string;
    folderPath?: string;
  }) {
    const path = params.folderPath
      ? `/me/drive/root:/${params.folderPath}/${params.name}:/content`
      : `/me/drive/root:/${params.name}:/content`;

    const result = await this.client.api(path).put(params.content);
    return result;
  }

  async listFiles(folderPath?: string) {
    const path = folderPath
      ? `/me/drive/root:/${folderPath}:/children`
      : '/me/drive/root/children';

    const result = await this.client.api(path).get();
    return result.value;
  }

  async downloadFile(fileId: string) {
    const result = await this.client.api(`/me/drive/items/${fileId}/content`).get();
    return result;
  }

  // Word document operations
  async createWordDocument(name: string, content: string) {
    // Create empty Word doc
    const doc = await this.uploadFile({
      name: `${name}.docx`,
      content: Buffer.from(''), // Empty docx template
    });

    // TODO: Use Office.js or docx library to populate content
    return doc;
  }

  // Excel operations
  async createExcelSpreadsheet(name: string, data: any[][]) {
    // Create empty Excel file
    const file = await this.uploadFile({
      name: `${name}.xlsx`,
      content: Buffer.from(''), // Empty xlsx template
    });

    // Add data using Microsoft Graph workbook API
    await this.client
      .api(`/me/drive/items/${file.id}/workbook/worksheets/Sheet1/range(address='A1:Z100')`)
      .patch({ values: data });

    return file;
  }
}
```

**Estimated Time**: 8-10 hours

---

### 3.3 Create Microsoft Office Agent Tools

**Files to Create**:
- `/src/lib/agent/tools/microsoft-email.ts`
- `/src/lib/agent/tools/microsoft-calendar.ts`
- `/src/lib/agent/tools/microsoft-office.ts`

**Example Tools**:

```typescript
// /src/lib/agent/tools/microsoft-office.ts

export class MicrosoftWordCreateTool implements AgentTool {
  name = 'microsoft.word.create';
  description = 'Create a new Microsoft Word document in OneDrive';
  category = 'integration' as const;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const user = await context.db.user.findUnique({
      where: { id: context.userId },
      select: {
        microsoftAccessToken: true,
        microsoftOfficeEnabled: true,
      },
    });

    if (!user?.microsoftOfficeEnabled) {
      return {
        success: false,
        error: 'Microsoft Office not connected. Go to /settings/integrations',
      };
    }

    const onedrive = new MicrosoftOneDriveClient(user.microsoftAccessToken!);

    const doc = await onedrive.createWordDocument(
      params.fileName,
      params.content
    );

    return {
      success: true,
      data: {
        fileId: doc.id,
        webUrl: doc.webUrl,
      },
    };
  }

  estimateCost(): number {
    return 30;
  }
}

export class MicrosoftExcelCreateTool implements AgentTool {
  name = 'microsoft.excel.create';
  description = 'Create a new Microsoft Excel spreadsheet in OneDrive';

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const user = await getUserWithMicrosoft(context.userId, context.db);
    const onedrive = new MicrosoftOneDriveClient(user.microsoftAccessToken!);

    const file = await onedrive.createExcelSpreadsheet(
      params.fileName,
      params.data // 2D array of data
    );

    return {
      success: true,
      data: {
        fileId: file.id,
        webUrl: file.webUrl,
      },
    };
  }

  estimateCost(): number {
    return 30;
  }
}

export class MicrosoftOneDriveUploadTool implements AgentTool {
  name = 'microsoft.onedrive.upload';
  description = 'Upload a file to Microsoft OneDrive';

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const user = await getUserWithMicrosoft(context.userId, context.db);
    const onedrive = new MicrosoftOneDriveClient(user.microsoftAccessToken!);

    const file = await onedrive.uploadFile({
      name: params.fileName,
      content: params.content,
      folderPath: params.folderPath,
    });

    return {
      success: true,
      data: {
        fileId: file.id,
        webUrl: file.webUrl,
      },
    };
  }

  estimateCost(): number {
    return 20;
  }
}
```

**Estimated Time**: 4-5 hours

---

## Phase 4: Production Infrastructure (Week 4)

### Priority: CRITICAL for Production | Effort: 20-25 hours | Impact: HIGH

### 4.1 Implement Job Queue System

**Problem**: Current code uses `setTimeout` for async execution - not production-ready.

**Solution**: Implement BullMQ or Inngest for job processing.

**Option A: BullMQ** (Recommended)

**Install**:
```bash
npm install bullmq ioredis
```

**Implementation**:

```typescript
// /src/lib/queue/agent-queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export const agentQueue = new Queue('agent-tasks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

// Worker to process jobs
const worker = new Worker(
  'agent-tasks',
  async (job) => {
    const { taskId, goal, agentType, config } = job.data;

    // Execute agent task
    const executor = new AgentExecutor({
      db: prisma,
      aiRouter,
    });

    const result = await executor.execute({
      taskId,
      goal,
      agentType,
      config,
    });

    return result;
  },
  { connection: redis }
);

// Event listeners
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// Queue job from API
export async function queueAgentTask(params: {
  taskId: string;
  goal: string;
  agentType: string;
  config: any;
  delay?: number;
}) {
  const job = await agentQueue.add('execute', params, {
    delay: params.delay,
  });

  return job.id;
}
```

**Update Agent Execution API**:

```typescript
// /src/app/api/agent/execute/route.ts

import { queueAgentTask } from '@/lib/queue/agent-queue';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { goal, agentType, config, async } = await req.json();

  // Create task
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: goal,
      status: 'pending',
      agentType,
      agentConfig: config,
    },
  });

  if (async) {
    // Queue for background execution
    const jobId = await queueAgentTask({
      taskId: task.id,
      goal,
      agentType,
      config,
    });

    return NextResponse.json({
      success: true,
      taskId: task.id,
      jobId,
      status: 'queued',
    });
  } else {
    // Execute synchronously (existing code)
    const executor = new AgentExecutor({ db: prisma, aiRouter });
    const result = await executor.execute({ ... });

    return NextResponse.json(result);
  }
}
```

**Estimated Time**: 8-10 hours

---

### 4.2 Implement Workflow Scheduler

**Problem**: Price monitor has `checkFrequency` but no actual scheduler.

**Solution**: Use node-cron or Inngest for scheduled workflows.

**Implementation**:

```typescript
// /src/lib/scheduler/workflow-scheduler.ts
import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { queueAgentTask } from '@/lib/queue/agent-queue';

export class WorkflowScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  async start() {
    // Load all active scheduled workflows
    const workflows = await prisma.workflow.findMany({
      where: {
        status: 'active',
        schedule: { not: null },
      },
    });

    for (const workflow of workflows) {
      this.scheduleWorkflow(workflow);
    }

    console.log(`Loaded ${workflows.length} scheduled workflows`);
  }

  scheduleWorkflow(workflow: any) {
    const cronExpression = this.getCronExpression(
      workflow.schedule.frequency,
      workflow.schedule.time
    );

    const task = cron.schedule(cronExpression, async () => {
      console.log(`Running workflow ${workflow.id}`);

      await queueAgentTask({
        taskId: workflow.id,
        goal: workflow.goal,
        agentType: workflow.type,
        config: workflow.config,
      });
    });

    this.tasks.set(workflow.id, task);
  }

  stopWorkflow(workflowId: string) {
    const task = this.tasks.get(workflowId);
    if (task) {
      task.stop();
      this.tasks.delete(workflowId);
    }
  }

  private getCronExpression(frequency: string, time?: string): string {
    switch (frequency) {
      case 'hourly':
        return '0 * * * *'; // Every hour
      case 'daily':
        const [hour, minute] = (time || '09:00').split(':');
        return `${minute} ${hour} * * *`; // Daily at specified time
      case 'weekly':
        return `${minute} ${hour} * * 1`; // Weekly on Monday
      default:
        return '0 9 * * *'; // Default to daily at 9am
    }
  }
}

// Start scheduler
export const workflowScheduler = new WorkflowScheduler();

// In your app startup (e.g., instrumentation.ts)
workflowScheduler.start();
```

**Database Schema Update**:

```prisma
model Workflow {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  name      String
  type      String   // price_monitor, email_campaign, etc.
  status    String   // active, paused, completed

  goal      String   @db.Text
  config    Json

  schedule  Json?    // { frequency: 'daily', time: '09:00' }

  lastRunAt DateTime?
  nextRunAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([status])
}
```

**Estimated Time**: 6-8 hours

---

### 4.3 Build Agent Monitoring Dashboard

**Purpose**: Track agent performance, credit usage, task success/failure rates.

**New Pages**:
- `/dashboard/agents` - Overview of all agents
- `/dashboard/agents/[id]` - Individual agent details
- `/dashboard/tasks` - All task executions

**Example Implementation**:

```typescript
// /src/app/dashboard/agents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function AgentDashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/agent/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Agent Performance</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-gray-600">Total Tasks</div>
          <div className="text-3xl font-bold">{metrics?.totalTasks}</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-3xl font-bold text-green-600">
            {metrics?.successRate}%
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-gray-600">Credits Used</div>
          <div className="text-3xl font-bold">{metrics?.creditsUsed}</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-gray-600">Avg Duration</div>
          <div className="text-3xl font-bold">{metrics?.avgDuration}s</div>
        </Card>
      </div>

      {/* Task Chart */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Tasks by Agent Type</h2>
        <BarChart width={800} height={300} data={metrics?.byAgentType}>
          <XAxis dataKey="agentType" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" fill="#10b981" />
          <Bar dataKey="failed" fill="#ef4444" />
        </BarChart>
      </Card>

      {/* Recent Tasks */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Tasks</h2>
        <div className="space-y-2">
          {metrics?.recentTasks?.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-gray-600">{task.agentType}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded text-sm ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {task.status}
                </div>
                <div className="text-sm text-gray-600">
                  {task.creditsUsed} credits
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

**API Endpoint**:

```typescript
// /src/app/api/agent/metrics/route.ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get aggregate metrics
  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
  });

  const totalTasks = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const successRate = totalTasks > 0 ? ((completed / totalTasks) * 100).toFixed(1) : 0;

  const creditsUsed = tasks.reduce((sum, t) => sum + t.totalCredits, 0);
  const avgDuration = totalTasks > 0
    ? (tasks.reduce((sum, t) => sum + t.executionTime, 0) / totalTasks / 1000).toFixed(1)
    : 0;

  // Group by agent type
  const byAgentType = tasks.reduce((acc: any, task) => {
    const type = task.agentType || 'unknown';
    if (!acc[type]) {
      acc[type] = { agentType: type, completed: 0, failed: 0 };
    }
    if (task.status === 'completed') acc[type].completed++;
    if (task.status === 'failed') acc[type].failed++;
    return acc;
  }, {});

  // Recent tasks
  const recentTasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      agentType: true,
      status: true,
      totalCredits: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    totalTasks,
    successRate,
    creditsUsed,
    avgDuration,
    byAgentType: Object.values(byAgentType),
    recentTasks,
  });
}
```

**Estimated Time**: 8-10 hours

---

## Implementation Timeline

### Week 1: Connect Existing Components ✅
**Days 1-2**: Browser tools → Browser control (3-4 hours)
**Day 2**: Email tools → Gmail client (1-2 hours)
**Days 3-4**: Google Drive tools (3-4 hours)
**Day 4**: Google Calendar tools (2-3 hours)
**Day 5**: Testing and bug fixes (4 hours)

**Total**: ~15 hours

---

### Week 2: Terminal & Script Execution 🔧
**Days 1-2**: Security architecture + Docker setup (8-10 hours)
**Days 3-4**: Terminal tool implementation (6-8 hours)
**Day 5**: Script management tools (6-8 hours)

**Total**: ~25 hours

---

### Week 3: Microsoft Office Integration 📊
**Days 1-2**: Microsoft OAuth + Graph setup (4-5 hours)
**Days 3-4**: Microsoft service clients (8-10 hours)
**Day 5**: Microsoft agent tools (4-5 hours)

**Total**: ~20 hours

---

### Week 4: Production Infrastructure 🚀
**Days 1-2**: BullMQ job queue (8-10 hours)
**Day 3**: Workflow scheduler (6-8 hours)
**Days 4-5**: Monitoring dashboard (8-10 hours)

**Total**: ~25 hours

---

## Total Effort Estimate

**Phase 1**: 15 hours
**Phase 2**: 25 hours
**Phase 3**: 20 hours
**Phase 4**: 25 hours

**Total**: ~85 hours (~2 months part-time, ~3 weeks full-time)

---

## Testing Strategy

### Unit Tests

```typescript
// /tests/agent/tools/browser.test.ts
describe('BrowserNavigateTool', () => {
  it('should navigate to URL', async () => {
    const tool = new BrowserNavigateTool();
    const result = await tool.execute(
      { url: 'https://example.com' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('url');
  });

  it('should validate URLs', () => {
    const tool = new BrowserNavigateTool();
    const validation = tool.validate({ url: 'not-a-url' });

    expect(validation.valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
// /tests/agent/workflows/price-monitor.test.ts
describe('Price Monitor Workflow', () => {
  it('should execute full workflow', async () => {
    const executor = new AgentExecutor({
      db: prisma,
      aiRouter,
    });

    const result = await executor.execute({
      goal: 'Monitor Amazon price for iPhone',
      agentType: 'price_monitor',
      config: {
        url: 'https://amazon.com/iphone',
        selector: '#priceblock_ourprice',
        threshold: 999,
        email: 'test@example.com',
      },
    });

    expect(result.success).toBe(true);
    expect(result.metrics.steps).toBeGreaterThan(0);
  });
});
```

### End-to-End Tests

```bash
# Test complete agent flow
npm run test:e2e
```

---

## Security Considerations

### 1. Terminal Execution
- ✅ Docker sandboxing
- ✅ Command whitelist
- ✅ Resource limits (CPU, RAM, network)
- ✅ Timeout enforcement
- ✅ Audit logging

### 2. OAuth Tokens
- ✅ Encrypted at rest in database
- ✅ Automatic refresh before expiry
- ✅ Revocation on disconnect
- ✅ Scope-based permissions

### 3. Browser Automation
- ✅ URL validation (block private IPs)
- ✅ XSS detection
- ✅ Prompt injection detection
- ✅ Rate limiting
- ✅ Session timeouts

### 4. Credit Management
- ✅ Pre-execution cost estimation
- ✅ Insufficient credit checks
- ✅ Usage tracking
- ✅ Audit trail

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] All 5 browser tools execute real browser actions
- [ ] Email sending works via Gmail
- [ ] 6 Drive tools fully functional
- [ ] 4 Calendar tools fully functional
- [ ] 95%+ tool success rate in tests

### Phase 2 Success Criteria
- [ ] Terminal commands execute in Docker
- [ ] Script creation and execution works
- [ ] Security audit passes
- [ ] No command injection vulnerabilities

### Phase 3 Success Criteria
- [ ] Microsoft OAuth flow works
- [ ] Can send emails via Outlook
- [ ] Can create Word/Excel documents
- [ ] OneDrive upload/download works

### Phase 4 Success Criteria
- [ ] Job queue handles 100+ concurrent jobs
- [ ] Workflows execute on schedule
- [ ] Dashboard shows real-time metrics
- [ ] System handles 1000+ tasks/day

---

## Deployment Checklist

### Environment Variables

```env
# Terminal Execution
DOCKER_HOST=unix:///var/run/docker.sock
TERMINAL_TIMEOUT=30000

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret

# Job Queue
REDIS_URL=redis://localhost:6379

# Security
ALLOWED_COMMANDS=ls,cat,grep,node,python3
MAX_EXECUTION_TIME=30000
```

### Database Migrations

```bash
# Add new models
npx prisma migrate dev --name add-script-models
npx prisma migrate dev --name add-microsoft-oauth

# Deploy to production
npx prisma migrate deploy
```

### Docker Setup

```bash
# Pull base images for terminal execution
docker pull node:18-alpine
docker pull python:3.11-alpine

# Test Docker access
docker ps
```

### Vercel Configuration

```json
// vercel.json
{
  "env": {
    "DOCKER_HOST": "tcp://docker-host:2375",
    "REDIS_URL": "@redis-url"
  },
  "functions": {
    "api/agent/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

---

## Next Steps

1. **Start with Phase 1** (Week 1) - Highest ROI, builds on existing code
2. **Test thoroughly** - Each phase before moving to next
3. **Deploy incrementally** - Phase by phase to production
4. **Monitor metrics** - Track success rates and costs
5. **Iterate based on usage** - Focus on most-used features

**You already have 75% of this built. The main work is connecting the pieces and adding production infrastructure.**
