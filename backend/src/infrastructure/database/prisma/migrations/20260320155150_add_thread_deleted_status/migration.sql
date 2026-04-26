-- AlterEnum
ALTER TYPE "ThreadStatus" ADD VALUE 'DELETED';

-- DropIndex
DROP INDEX "note_chunk_embedding_ivfflat_idx";
