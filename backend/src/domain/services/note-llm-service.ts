export interface RelatedThread {
  threadId: string;
  title: string;
  description: string | null;
  panel: string;
  replyCount: number;
  voteScore: number;
  similarityScore: number;
}

export interface NoteLLMService {
  // Chunk a note's text and store embeddings for each chunk
  embedNote(noteId: string, title: string, contentJson: unknown): Promise<void>;

  // Find related threads by searching chunk embeddings
  findRelatedThreads(
    title: string,
    contentJson: unknown,
    limit?: number,
    threshold?: number,
  ): Promise<RelatedThread[]>;
}