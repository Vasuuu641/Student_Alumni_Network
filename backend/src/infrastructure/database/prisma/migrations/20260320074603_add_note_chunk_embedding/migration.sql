-- CreateTable
CREATE TABLE "NoteChunkEmbedding" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteChunkEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteChunkEmbedding_chunkId_key" ON "NoteChunkEmbedding"("chunkId");

-- CreateIndex
CREATE INDEX "NoteChunkEmbedding_chunkId_idx" ON "NoteChunkEmbedding"("chunkId");

-- CreateIndex
CREATE INDEX "NoteChunkEmbedding_noteId_idx" ON "NoteChunkEmbedding"("noteId");

-- AddForeignKey
ALTER TABLE "NoteChunkEmbedding" ADD CONSTRAINT "NoteChunkEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "NoteChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteChunkEmbedding" ADD CONSTRAINT "NoteChunkEmbedding_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
