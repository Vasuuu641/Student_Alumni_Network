import { ThreadPanel } from '../entities/thread.entity';

export interface SimilarThread {
  threadId: string;
  title: string;
  panel: ThreadPanel;
  replyCount: number;
  voteScore: number;
  similarityScore: number;
}

export interface ThreadLLMService {
  // Embed a thread title and store the vector
  embedThread(threadId: string, title: string): Promise<void>;

  // Find similar threads by semantic meaning of the query text
  findSimilarThreads(
    query: string,
    userPanel: ThreadPanel | null,
    limit?: number,
    threshold?: number,
  ): Promise<SimilarThread[]>;
}