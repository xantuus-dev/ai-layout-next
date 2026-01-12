import { google, drive_v3 } from 'googleapis';
import { getAuthenticatedClient } from './google-oauth';
import { Readable } from 'stream';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface UploadOptions {
  name: string;
  mimeType: string;
  content: Buffer | Readable | string;
  folderId?: string;
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive | null = null;

  constructor(
    private accessToken: string,
    private refreshToken: string | null,
    private expiryDate: Date | null
  ) {}

  /**
   * Initialize the Drive API client
   */
  private async init() {
    if (!this.drive) {
      const auth = await getAuthenticatedClient(
        this.accessToken,
        this.refreshToken,
        this.expiryDate
      );
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  /**
   * List files in Drive
   */
  async listFiles(options?: {
    folderId?: string;
    pageSize?: number;
    query?: string;
    orderBy?: string;
  }): Promise<DriveFile[]> {
    const drive = await this.init();

    let query = options?.query || '';
    if (options?.folderId) {
      query += (query ? ' and ' : '') + `'${options.folderId}' in parents`;
    }
    if (!query.includes('trashed')) {
      query += (query ? ' and ' : '') + 'trashed = false';
    }

    const response = await drive.files.list({
      pageSize: options?.pageSize || 100,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink)',
      q: query || undefined,
      orderBy: options?.orderBy || 'modifiedTime desc',
    });

    return (response.data.files || []) as DriveFile[];
  }

  /**
   * Upload a file to Drive
   */
  async uploadFile(options: UploadOptions): Promise<DriveFile> {
    const drive = await this.init();

    const fileMetadata: drive_v3.Schema$File = {
      name: options.name,
      ...(options.folderId && { parents: [options.folderId] }),
    };

    const media = {
      mimeType: options.mimeType,
      body: typeof options.content === 'string'
        ? Readable.from([options.content])
        : options.content instanceof Buffer
        ? Readable.from([options.content])
        : options.content,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink',
    });

    return response.data as DriveFile;
  }

  /**
   * Create a Google Doc with content
   */
  async createDoc(name: string, content: string, folderId?: string): Promise<DriveFile> {
    return this.uploadFile({
      name,
      mimeType: 'application/vnd.google-apps.document',
      content,
      folderId,
    });
  }

  /**
   * Create a Google Sheet
   */
  async createSheet(name: string, folderId?: string): Promise<DriveFile> {
    const drive = await this.init();

    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      ...(folderId && { parents: [folderId] }),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, webViewLink',
    });

    return response.data as DriveFile;
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<DriveFile> {
    const drive = await this.init();

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink',
    });

    return response.data as DriveFile;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const drive = await this.init();

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const drive = await this.init();
    await drive.files.delete({ fileId });
  }

  /**
   * Share a file with specific users or make it public
   */
  async shareFile(
    fileId: string,
    options: {
      email?: string;
      role?: 'reader' | 'writer' | 'commenter';
      type?: 'user' | 'anyone';
    }
  ): Promise<void> {
    const drive = await this.init();

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: options.role || 'reader',
        type: options.type || (options.email ? 'user' : 'anyone'),
        ...(options.email && { emailAddress: options.email }),
      },
    });
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentFolderId?: string): Promise<DriveFile> {
    const drive = await this.init();

    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, webViewLink',
    });

    return response.data as DriveFile;
  }
}
