export enum ThreadPanel {
  ACADEMIC = 'ACADEMIC',
  ALUMNI = 'ALUMNI',
}

export enum ThreadStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PINNED = 'PINNED',
  DELETED = 'DELETED',
}

export enum ReplyStatus {
  ACTIVE = 'ACTIVE',
  EDITED = 'EDITED',
  DELETED = 'DELETED',
}

export enum VoteType {
  UPVOTE = 'UPVOTE',
  DOWNVOTE = 'DOWNVOTE',
}

export class Thread {
  constructor(
    public readonly id: string,
    public title: string,
    public description: string | null,
    public panel: ThreadPanel,
    public status: ThreadStatus,
    public readonly authorId: string,
    public replyCount: number,
    public lastReplyAt: Date | null,
    public viewCount: number,
    public voteScore: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  isOpen(): boolean {
    return this.status === ThreadStatus.OPEN;
  }

  canAcceptReplies(): boolean {
    return this.status === ThreadStatus.OPEN || this.status === ThreadStatus.PINNED;
  }
}

export class ThreadReply {
  constructor(
    public readonly id: string,
    public readonly threadId: string,
    public content: string,
    public readonly authorId: string,
    public status: ReplyStatus,
    public editedAt: Date | null,
    public voteScore: number,
    public readonly parentReplyId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  isDeleted(): boolean {
    return this.status === ReplyStatus.DELETED;
  }
}