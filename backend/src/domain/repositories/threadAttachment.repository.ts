// domain/repositories/threadAttachment.repository.ts
import { ThreadAttachment } from '../entities/threadAttachment.entity';

export interface CreateThreadAttachmentData {
  threadId: string | null;
  replyId: string | null;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedById: string;
}

export interface ThreadAttachmentRepository {
  create(data: CreateThreadAttachmentData): Promise<ThreadAttachment>;
  findByThreadId(threadId: string): Promise<ThreadAttachment[]>;
  findByReplyId(replyId: string): Promise<ThreadAttachment[]>;
  delete(id: string): Promise<void>;
}