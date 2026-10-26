import { Readable } from 'stream';

export interface StorageSaveResult {
  storedFilename: string;
  storagePath: string;
  fileSize: number;
  fileHash: string;
}

export interface IStorageProvider {
  /**
   * Save a buffer or stream to the secure storage abstraction.
   */
  saveFile(
    data: Buffer,
    filename: string,
    subfolder?: string
  ): Promise<StorageSaveResult>;

  /**
   * Retrieve a readable stream for authorized streaming / downloading.
   */
  getFileStream(storagePath: string): Promise<Readable>;

  /**
   * Retrieve the file buffer.
   */
  getFileBuffer(storagePath: string): Promise<Buffer>;

  /**
   * Check if file exists in secure storage.
   */
  fileExists(storagePath: string): Promise<boolean>;

  /**
   * Delete a file from secure storage.
   */
  deleteFile(storagePath: string): Promise<boolean>;

  /**
   * Get the absolute safe local path (with traversal check).
   */
  getAbsolutePath(storagePath: string): string;
}
