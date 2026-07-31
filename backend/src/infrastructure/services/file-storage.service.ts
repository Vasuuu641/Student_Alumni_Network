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
import { FileStorageService, FileUploadRequest } from '../../domain/services/file-storage';
import { getErrorMessage } from '../../shared/utils/getErrorMessage';

@Injectable()
export class R2FileStorageService implements FileStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly validMimeTypes = ['image/jpeg', 'image/png'];
  private readonly maxSize = 5 * 1024 * 1024; // 5MB

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
  ): Promise<string> {
    if (!this.validMimeTypes.includes(file.mimeType)) {
      throw new Error('Invalid file type. Only JPEG and PNG are allowed.');
    }
    if (file.size > this.maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty.');
    }

    const ext = this.getFileExtension(file.originalName);
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
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error: unknown) {
      throw new Error(`Failed to delete file at ${fileUrl}: ${getErrorMessage(error)}`);
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
    if (!fileUrl) return false;
    const key = fileUrl.replace(`${this.publicUrl}/`, '');

    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private getFileExtension(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'jpg' || ext === 'jpeg') return '.jpg';
    if (ext === 'png') return '.png';
    return '.jpg';
  }
}