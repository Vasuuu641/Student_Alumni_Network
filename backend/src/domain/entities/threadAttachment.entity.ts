export class ThreadAttachment {
  constructor(
    public readonly id: string,
    public readonly threadId: string | null,
    public readonly replyId: string | null,
    public readonly key: string,
    public readonly url: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly uploadedById: string,
    public readonly createdAt: Date,
  ) {}

  belongsToThread(): boolean {
    return this.threadId !== null;
  }

  belongsToReply(): boolean {
    return this.replyId !== null;
  }

  isUploadedBy(userId: string): boolean {
    return this.uploadedById === userId;
  }
}