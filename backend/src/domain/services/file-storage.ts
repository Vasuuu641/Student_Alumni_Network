export interface FileUploadRequest {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface FileUploadOptions {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
}

export interface FileStorageService {
  uploadFile(
    category: string,
    userId: string,
    file: FileUploadRequest,
    options: FileUploadOptions,
  ): Promise<string>;

  deleteFile(fileUrl: string): Promise<void>;
  fileExists(fileUrl: string): Promise<boolean>;
}