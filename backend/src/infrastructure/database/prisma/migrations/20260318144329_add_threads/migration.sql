-- CreateEnum
CREATE TYPE "ThreadPanel" AS ENUM ('ACADEMIC', 'ALUMNI');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'PINNED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('ACTIVE', 'EDITED', 'DELETED');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "panel" "ThreadPanel" NOT NULL DEFAULT 'ACADEMIC',
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "authorId" TEXT NOT NULL,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "voteScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadReply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "ReplyStatus" NOT NULL DEFAULT 'ACTIVE',
    "editedAt" TIMESTAMP(3),
    "voteScore" INTEGER NOT NULL DEFAULT 0,
    "parentReplyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadVote" (
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadVote_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateTable
CREATE TABLE "ThreadReplyVote" (
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadReplyVote_pkey" PRIMARY KEY ("replyId","userId")
);

-- CreateIndex
CREATE INDEX "Thread_panel_status_createdAt_idx" ON "Thread"("panel", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Thread_authorId_idx" ON "Thread"("authorId");

-- CreateIndex
CREATE INDEX "Thread_lastReplyAt_idx" ON "Thread"("lastReplyAt");

-- CreateIndex
CREATE INDEX "Thread_panel_status_replyCount_idx" ON "Thread"("panel", "status", "replyCount");

-- CreateIndex
CREATE INDEX "Thread_panel_status_voteScore_idx" ON "Thread"("panel", "status", "voteScore");

-- CreateIndex
CREATE INDEX "ThreadReply_threadId_createdAt_idx" ON "ThreadReply"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ThreadReply_threadId_voteScore_idx" ON "ThreadReply"("threadId", "voteScore");

-- CreateIndex
CREATE INDEX "ThreadReply_authorId_idx" ON "ThreadReply"("authorId");

-- CreateIndex
CREATE INDEX "ThreadReply_parentReplyId_idx" ON "ThreadReply"("parentReplyId");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReply" ADD CONSTRAINT "ThreadReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReply" ADD CONSTRAINT "ThreadReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReply" ADD CONSTRAINT "ThreadReply_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "ThreadReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadVote" ADD CONSTRAINT "ThreadVote_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadVote" ADD CONSTRAINT "ThreadVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReplyVote" ADD CONSTRAINT "ThreadReplyVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ThreadReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReplyVote" ADD CONSTRAINT "ThreadReplyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
