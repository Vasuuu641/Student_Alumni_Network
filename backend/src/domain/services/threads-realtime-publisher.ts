import { ThreadReply } from '../entities/thread.entity';

export interface VoteBroadcastPayload {
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
}

export interface ThreadsRealtimePublisher {
  broadcastReplyPosted(threadId: string, reply: ThreadReply): void;
  broadcastReplyEdited(threadId: string, replyId: string, content: string): void;
  broadcastReplyDeleted(threadId: string, replyId: string): void;
  broadcastThreadVoted(threadId: string, payload: VoteBroadcastPayload): void;
  broadcastReplyVoted(threadId: string, replyId: string, payload: VoteBroadcastPayload): void;
}