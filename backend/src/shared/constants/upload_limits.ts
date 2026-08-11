// shared/constants/upload-limits.ts
import { FileUploadOptions } from '../../domain/services/file-storage';

export const PROFILE_PICTURE_UPLOAD_OPTIONS: FileUploadOptions = {
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
};

export const THREAD_ATTACHMENT_UPLOAD_OPTIONS: FileUploadOptions = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxSizeBytes: 8 * 1024 * 1024, // 8MB — images + short docs, not heavy files
};

export const NOTE_IMAGE_UPLOAD_OPTIONS: FileUploadOptions = {
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
};

export const GROUP_POST_ATTACHMENT_UPLOAD_OPTIONS: FileUploadOptions = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxSizeBytes: 8 * 1024 * 1024, // 8MB
};