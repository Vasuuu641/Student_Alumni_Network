import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { FileStorageService, FileUploadRequest } from '../../domain/services/file-storage';

@Injectable()
export class LocalFileStorageService implements FileStorageService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private readonly baseUrl = '/uploads';
  private readonly validMimeTypes = ['image/jpeg', 'image/png'];
  private readonly maxSize = 5 * 1024 * 1024; // 5MB

  async uploadFile(
    category: string,
    userId: string,
    file: FileUploadRequest
  ): Promise<string> {
    // Validate file type - only JPEG and PNG
    if (!this.validMimeTypes.includes(file.mimeType)) {
      throw new Error('Invalid file type. Only JPEG and PNG are allowed.');
    }

    // Validate file size
    if (file.size > this.maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }

    // Validate file buffer
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty.');
    }

    // Create directory structure
    const categoryDir = path.join(this.uploadsDir, category);
    
    try {
      await fs.mkdir(categoryDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create upload directory: ${error.message}`);
    }

    // Generate unique filename using UUID to prevent conflicts
    const ext = this.getFileExtension(file.originalName);
    const uniqueId = randomUUID();
    const timestamp = Date.now();
    const filename = `${userId}-${timestamp}-${uniqueId}${ext}`;
    const filePath = path.join(categoryDir, filename);

    // Write file atomically
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, file.buffer);
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to save file: ${error.message}`);
    }

    // Return URL-like path
    return `${this.baseUrl}/${category}/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      return; // Nothing to delete
    }

    // Convert URL back to file path
    const relativePath = fileUrl.replace(this.baseUrl, '');
    const filePath = path.join(this.uploadsDir, relativePath);

    try {
      // Check if file exists before attempting delete
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      // If file doesn't exist (ENOENT), it's fine - already deleted
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete file at ${fileUrl}: ${error.message}`);
      }
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
    if (!fileUrl) {
      return false;
    }

    const relativePath = fileUrl.replace(this.baseUrl, '');
    const filePath = path.join(this.uploadsDir, relativePath);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getFileExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    // Only allow jpg and png extensions
    if (ext === '.jpg' || ext === '.jpeg') {
      return '.jpg';
    } else if (ext === '.png') {
      return '.png';
    }
    
    // Default to jpg if extension is invalid or missing
    return '.jpg';
  }
}
