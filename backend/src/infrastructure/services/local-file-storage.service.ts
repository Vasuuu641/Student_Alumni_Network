import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStorageService, FileUploadRequest } from '../../domain/services/file-storage';

@Injectable()
export class LocalFileStorageService implements FileStorageService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private readonly baseUrl = '/uploads';

  async uploadFile(
    category: string,
    userId: string,
    file: FileUploadRequest
  ): Promise<string> {
    // Validate file
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(file.mimeType)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }

    // Create directory structure
    const categoryDir = path.join(this.uploadsDir, category);
    await fs.mkdir(categoryDir, { recursive: true });

    // Generate filename
    const ext = this.getFileExtension(file.originalName);
    const filename = `${userId}-${Date.now()}${ext}`;
    const filePath = path.join(categoryDir, filename);

    // Write file
    await fs.writeFile(filePath, file.buffer);

    // Return URL-like path
    return `${this.baseUrl}/${category}/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Convert URL back to file path
    const relativePath = fileUrl.replace(this.baseUrl, '');
    const filePath = path.join(this.uploadsDir, relativePath);

    // Check if file exists before deleting
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, silently continue
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
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
    const ext = path.extname(filename);
    return ext || '.jpg';
  }
}
