export interface FileUploadRequest {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface FileStorageService {
  /**
   * Upload a file and return the URL/path where it can be accessed
   */
  uploadFile(
    category: string, // e.g., 'student-profiles', 'alumni-profiles'
    userId: string,
    file: FileUploadRequest
  ): Promise<string>;

  /**
   * Delete a file by its URL/path
   */
  deleteFile(fileUrl: string): Promise<void>;

  /**
   * Check if a file exists
   */
  fileExists(fileUrl: string): Promise<boolean>;
}
