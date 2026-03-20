ALTER TABLE "NoteChunkEmbedding" ADD COLUMN embedding vector(1024);

CREATE INDEX note_chunk_embedding_ivfflat_idx ON "NoteChunkEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);