import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { IStorageProvider, StorageSaveResult } from './IStorageProvider.js';
import { AppError } from '../utils/AppError.js';

export class LocalStorageProvider implements IStorageProvider {
  private readonly rootDir: string;

  constructor(customPath?: string) {
    this.rootDir = customPath
      ? path.resolve(customPath)
      : path.resolve(process.cwd(), 'storage', 'secure_documents');

    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  /**
   * Asserts and returns a safe absolute path, strictly forbidding directory traversal.
   */
  public getAbsolutePath(storagePath: string): string {
    const resolved = path.resolve(this.rootDir, storagePath);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw AppError.forbidden('Security Violation: Invalid storage path or directory traversal detected.');
    }

    return resolved;
  }

  /**
   * Saves a file buffer securely with SHA-256 integrity hash.
   */
  async saveFile(
    data: Buffer,
    safeFilename: string,
    subfolder?: string
  ): Promise<StorageSaveResult> {
    const folder = subfolder ? subfolder.replace(/[^a-zA-Z0-9_-]/g, '_') : 'general';
    const targetDir = path.resolve(this.rootDir, folder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const relPath = path.join(folder, safeFilename);
    const fullPath = this.getAbsolutePath(relPath);

    // Compute SHA-256
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    // Write file
    await fs.promises.writeFile(fullPath, data);

    return {
      storedFilename: safeFilename,
      storagePath: relPath.replace(/\\/g, '/'),
      fileSize: data.length,
      fileHash: hash,
    };
  }

  /**
   * Retrieves a readable file stream for authorized streaming.
   */
  async getFileStream(storagePath: string): Promise<Readable> {
    const fullPath = this.getAbsolutePath(storagePath);
    if (!fs.existsSync(fullPath)) {
      throw AppError.notFound('Requested secure document file does not exist on storage.');
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Retrieves the raw file buffer.
   */
  async getFileBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = this.getAbsolutePath(storagePath);
    if (!fs.existsSync(fullPath)) {
      throw AppError.notFound('Requested secure document file does not exist on storage.');
    }
    return fs.promises.readFile(fullPath);
  }

  /**
   * Checks if the document exists in storage.
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const fullPath = this.getAbsolutePath(storagePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Deletes a document file from storage.
   */
  async deleteFile(storagePath: string): Promise<boolean> {
    try {
      const fullPath = this.getAbsolutePath(storagePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const defaultStorageProvider = new LocalStorageProvider();
