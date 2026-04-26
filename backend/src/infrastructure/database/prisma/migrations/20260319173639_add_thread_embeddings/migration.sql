CREATE TABLE "ThreadEmbedding" (
  "id"        TEXT NOT NULL,
  "threadId"  TEXT NOT NULL,
  "embedding" vector(1024),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ThreadEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThreadEmbedding_threadId_key" ON "ThreadEmbedding"("threadId");
CREATE INDEX "ThreadEmbedding_threadId_idx" ON "ThreadEmbedding"("threadId");

ALTER TABLE "ThreadEmbedding"
  ADD CONSTRAINT "ThreadEmbedding_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX ON "ThreadEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);