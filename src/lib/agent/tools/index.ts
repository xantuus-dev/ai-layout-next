/**
 * Tool Initialization - Register all available tools
 */

import { toolRegistry } from './registry';

// Browser tools
import {
  BrowserNavigateTool,
  BrowserExtractTool,
  BrowserClickTool,
  BrowserScreenshotTool,
  BrowserWaitForTool,
} from './browser';

// Email tools
import {
  EmailSendTool,
  EmailSendBatchTool,
} from './email';

// Document tools
import {
  DocumentCreatePdfTool,
  DocumentCreateDocxTool,
  DocumentCreateDeckTool,
} from './documents';

// Spreadsheet tool
import { DocumentCreateXlsxTool } from './spreadsheets';

// Chart rendering tool
import { ChartRenderTool } from './charts';

// Image generation tool
import { ImageGenerateTool } from './image-generate';

// Google Drive tools
import {
  DriveUploadTool,
  DriveListTool,
  DriveCreateDocTool,
  DriveCreateSheetTool,
  DriveDownloadTool,
  DriveShareTool,
} from './drive';

// Google Calendar tools
import {
  CalendarCreateEventTool,
  CalendarListEventsTool,
  CalendarUpdateEventTool,
  CalendarDeleteEventTool,
} from './calendar';

// HTTP tools
import {
  HttpGetTool,
  HttpPostTool,
} from './http';

// AI tools
import {
  AiChatTool,
  AiSummarizeTool,
  AiExtractTool,
} from './ai';

// Web search tool
import { WebSearchTool } from './websearch';

/**
 * Initialize all tools and register them
 */
export function initializeTools(): void {
  // Browser tools
  toolRegistry.register(new BrowserNavigateTool());
  toolRegistry.register(new BrowserExtractTool());
  toolRegistry.register(new BrowserClickTool());
  toolRegistry.register(new BrowserScreenshotTool());
  toolRegistry.register(new BrowserWaitForTool());

  // Email tools
  toolRegistry.register(new EmailSendTool());
  toolRegistry.register(new EmailSendBatchTool());

  // Google Drive tools
  toolRegistry.register(new DriveUploadTool());
  toolRegistry.register(new DriveListTool());
  toolRegistry.register(new DriveCreateDocTool());
  toolRegistry.register(new DriveCreateSheetTool());
  toolRegistry.register(new DriveDownloadTool());
  toolRegistry.register(new DriveShareTool());

  // Google Calendar tools
  toolRegistry.register(new CalendarCreateEventTool());
  toolRegistry.register(new CalendarListEventsTool());
  toolRegistry.register(new CalendarUpdateEventTool());
  toolRegistry.register(new CalendarDeleteEventTool());

  // HTTP tools
  toolRegistry.register(new HttpGetTool());
  toolRegistry.register(new HttpPostTool());

  // AI tools
  toolRegistry.register(new AiChatTool());
  toolRegistry.register(new AiSummarizeTool());
  toolRegistry.register(new AiExtractTool());

  // Web search
  toolRegistry.register(new WebSearchTool());

  // Document tools
  toolRegistry.register(new DocumentCreatePdfTool());
  toolRegistry.register(new DocumentCreateDocxTool());
  toolRegistry.register(new DocumentCreateDeckTool());
  toolRegistry.register(new DocumentCreateXlsxTool());

  // Chart rendering
  toolRegistry.register(new ChartRenderTool());

  // Image generation
  toolRegistry.register(new ImageGenerateTool());

  console.log(`[Agent] Initialized ${toolRegistry.getAllTools().length} tools`);
}

// Auto-initialize on import
initializeTools();

// Re-export registry
export { toolRegistry } from './registry';
