/**
 * Google Drive Tools - File management and document creation
 *
 * Integrates with existing Google Drive integration
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { GoogleDriveClient } from '@/lib/google-drive';

/**
 * Helper to get user with Drive permissions
 */
async function getUserWithDrive(userId: string, prisma: any) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
      googleDriveEnabled: true,
    },
  });

  if (!user?.googleDriveEnabled || !user.googleAccessToken) {
    throw new Error('Google Drive not connected. Please connect in /settings/integrations');
  }

  return user;
}

/**
 * Upload a file to Google Drive
 */
export class DriveUploadTool implements AgentTool {
  name = 'drive.upload';
  description = 'Upload a file to Google Drive. Provide fileName, content, and optional mimeType and folderId.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.fileName || typeof params.fileName !== 'string') {
      return { valid: false, error: 'fileName parameter required (string)' };
    }

    if (!params.content) {
      return { valid: false, error: 'content parameter required' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      fileName: string;
      content: string;
      mimeType?: string;
      folderId?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const file = await drive.uploadFile({
        name: params.fileName,
        content: params.content,
        mimeType: params.mimeType || 'text/plain',
        folderId: params.folderId,
      });

      return {
        success: true,
        data: {
          fileId: file.id,
          name: file.name,
          url: file.webViewLink,
          downloadUrl: file.webContentLink,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 20,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 20,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 20;
  }
}

/**
 * List files in Google Drive
 */
export class DriveListTool implements AgentTool {
  name = 'drive.list';
  description = 'List files in Google Drive. Optionally filter by folderId, query, or limit results.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    return { valid: true };
  }

  async execute(
    params: {
      folderId?: string;
      query?: string;
      maxResults?: number;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const files = await drive.listFiles({
        folderId: params.folderId,
        query: params.query,
        pageSize: params.maxResults || 20,
      });

      return {
        success: true,
        data: {
          count: files.length,
          files: files.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            modifiedTime: f.modifiedTime,
            url: f.webViewLink,
          })),
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10;
  }
}

/**
 * Create a Google Doc
 */
export class DriveCreateDocTool implements AgentTool {
  name = 'drive.createDoc';
  description = 'Create a new Google Doc with the specified title and content.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      title: string;
      content?: string;
      folderId?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const doc = await drive.createDoc(
        params.title,
        params.content || '',
        params.folderId
      );

      return {
        success: true,
        data: {
          docId: doc.id,
          name: doc.name,
          url: doc.webViewLink,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 30,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 30,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 30;
  }
}

/**
 * Create a Google Sheet
 */
export class DriveCreateSheetTool implements AgentTool {
  name = 'drive.createSheet';
  description = 'Create a new Google Sheet with the specified title.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      title: string;
      folderId?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const sheet = await drive.createSheet(
        params.title,
        params.folderId
      );

      return {
        success: true,
        data: {
          sheetId: sheet.id,
          name: sheet.name,
          url: sheet.webViewLink,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 30,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 30,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 30;
  }
}

/**
 * Download a file from Google Drive
 */
export class DriveDownloadTool implements AgentTool {
  name = 'drive.download';
  description = 'Download a file from Google Drive by its file ID.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.fileId || typeof params.fileId !== 'string') {
      return { valid: false, error: 'fileId parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: { fileId: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const content = await drive.downloadFile(params.fileId);
      const file = await drive.getFile(params.fileId);

      return {
        success: true,
        data: {
          fileId: file.id,
          name: file.name,
          content: content.toString('utf-8'),
          size: content.length,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 15,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 15,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 15;
  }
}

/**
 * Share a Google Drive file
 */
export class DriveShareTool implements AgentTool {
  name = 'drive.share';
  description = 'Share a Google Drive file with a specific email address or make it public.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.fileId || typeof params.fileId !== 'string') {
      return { valid: false, error: 'fileId parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      fileId: string;
      email?: string;
      role?: 'reader' | 'writer' | 'commenter';
      makePublic?: boolean;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithDrive(context.userId, context.prisma);

      const drive = new GoogleDriveClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      await drive.shareFile(params.fileId, {
        email: params.email,
        role: params.role || 'reader',
        type: params.makePublic ? 'anyone' : (params.email ? 'user' : 'anyone'),
      });

      const file = await drive.getFile(params.fileId);

      return {
        success: true,
        data: {
          fileId: params.fileId,
          name: file.name,
          sharedWith: params.email || 'anyone',
          role: params.role || 'reader',
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10;
  }
}
