-- DropIndex
DROP INDEX "ThreadEmbedding_embedding_idx";

-- CreateTable
CREATE TABLE "NoteChunk" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteThreadLink" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" "NoteLinkSource" NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteThreadLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteChunk_noteId_idx" ON "NoteChunk"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteChunk_noteId_chunkIndex_key" ON "NoteChunk"("noteId", "chunkIndex");

-- CreateIndex
CREATE INDEX "NoteThreadLink_noteId_idx" ON "NoteThreadLink"("noteId");

-- CreateIndex
CREATE INDEX "NoteThreadLink_threadId_idx" ON "NoteThreadLink"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteThreadLink_noteId_threadId_key" ON "NoteThreadLink"("noteId", "threadId");

-- AddForeignKey
ALTER TABLE "NoteChunk" ADD CONSTRAINT "NoteChunk_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteThreadLink" ADD CONSTRAINT "NoteThreadLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteThreadLink" ADD CONSTRAINT "NoteThreadLink_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
