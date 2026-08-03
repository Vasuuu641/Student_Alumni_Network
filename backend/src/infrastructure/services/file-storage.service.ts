// infrastructure/services/r2-file-storage.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { FileStorageService, FileUploadRequest, FileUploadOptions } from '../../domain/services/file-storage';
import { getErrorMessage } from '../../shared/utils/getErrorMessage';

@Injectable()
export class R2FileStorageService implements FileStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrl = this.config.getOrThrow<string>('R2_PUBLIC_URL');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadFile(
    category: string,
    userId: string,
    file: FileUploadRequest,
    options: FileUploadOptions,
  ): Promise<string> {
    if (!options.allowedMimeTypes.includes(file.mimeType)) {
      throw new Error(`Invalid file type. Allowed types: ${options.allowedMimeTypes.join(', ')}`);
    }
    if (file.size > options.maxSizeBytes) {
      throw new Error(`File size exceeds ${Math.round(options.maxSizeBytes / (1024 * 1024))}MB limit.`);
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty.');
    }

    const ext = this.getFileExtension(file.originalName, file.mimeType);
    const key = `${category}/${userId}-${Date.now()}-${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error: unknown) {
      throw new Error(`Failed to upload file to R2: ${getErrorMessage(error)}`);
    }

    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    const key = fileUrl.replace(`${this.publicUrl}/`, '');
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error: unknown) {
      throw new Error(`Failed to delete file at ${fileUrl}: ${getErrorMessage(error)}`);
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
    if (!fileUrl) return false;
    const key = fileUrl.replace(`${this.publicUrl}/`, '');
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private getFileExtension(filename: string, mimeType: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext && ['jpg', 'jpeg', 'png', 'pdf', 'webp'].includes(ext)) {
      return ext === 'jpeg' ? '.jpg' : `.${ext}`;
    }
    // Fallback based on mimeType if extension is missing/unreliable
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'application/pdf') return '.pdf';
    return '.jpg';
  }
}