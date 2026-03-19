import { ThreadReply } from '../entities/thread.entity';

export interface ThreadsRealtimePublisher {
  broadcastReplyPosted(threadId: string, reply: ThreadReply): void;
  broadcastReplyEdited(threadId: string, replyId: string, content: string): void;
  broadcastReplyDeleted(threadId: string, replyId: string): void;
  broadcastThreadVoted(threadId: string, voteScore: number): void;
  broadcastReplyVoted(threadId: string, replyId: string, voteScore: number): void;
}