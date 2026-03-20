import { Thread, ThreadPanel, ThreadReply, ThreadStatus } from '../entities/thread.entity';

export type ThreadSortBy = 'newest' | 'mostReplies' | 'topVoted';

export interface ThreadRepository {
  // Thread CRUD
  findById(id: string): Promise<Thread | null>;
  findByAuthorId(authorId: string): Promise<Thread[]>;
  create(thread: Thread): Promise<Thread>;
  update(thread: Thread): Promise<Thread>;
  updateStatus(threadId: string, status: ThreadStatus): Promise<Thread>;

  // Listing
  listByPanel(
    panel: ThreadPanel,
    options: { skip: number; take: number; sortBy: ThreadSortBy },
  ): Promise<{ threads: Thread[]; total: number }>;

  // Counts & increments
  incrementViewCount(threadId: string): Promise<void>;
  incrementReplyCount(threadId: string): Promise<void>;
  decrementReplyCount(threadId: string): Promise<void>;
}

export interface ThreadReplyRepository {
  // Reply CRUD
  findById(id: string): Promise<ThreadReply | null>;
  findByThreadId(
    threadId: string,
    options: { skip: number; take: number; sortBy: 'newest' | 'topVoted' },
  ): Promise<{ replies: ThreadReply[]; total: number }>;
  findChildReplies(parentReplyId: string): Promise<ThreadReply[]>;
  create(reply: ThreadReply): Promise<ThreadReply>;
  update(reply: ThreadReply): Promise<ThreadReply>;
  delete(replyId: string): Promise<void>;
}

export interface ThreadVoteRepository {
  // Thread votes
  findThreadVote(threadId: string, userId: string): Promise<{ voteType: 'UPVOTE' | 'DOWNVOTE' } | null>;
  countThreadVotesByType(threadId: string, voteType: 'UPVOTE' | 'DOWNVOTE'): Promise<number>;
  upsertThreadVote(threadId: string, userId: string, voteType: 'UPVOTE' | 'DOWNVOTE'): Promise<void>;
  deleteThreadVote(threadId: string, userId: string): Promise<void>;
  updateThreadVoteScore(threadId: string, delta: number): Promise<void>;

  // Reply votes
  findReplyVote(replyId: string, userId: string): Promise<{ voteType: 'UPVOTE' | 'DOWNVOTE' } | null>;
  countReplyVotesByType(replyId: string, voteType: 'UPVOTE' | 'DOWNVOTE'): Promise<number>;
  upsertReplyVote(replyId: string, userId: string, voteType: 'UPVOTE' | 'DOWNVOTE'): Promise<void>;
  deleteReplyVote(replyId: string, userId: string): Promise<void>;
  updateReplyVoteScore(replyId: string, delta: number): Promise<void>;
}