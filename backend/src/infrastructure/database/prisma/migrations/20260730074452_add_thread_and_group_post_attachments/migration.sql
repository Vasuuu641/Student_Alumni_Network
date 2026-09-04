-- CreateTable
CREATE TABLE "ThreadAttachment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupPostAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupPostAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThreadAttachment_threadId_idx" ON "ThreadAttachment"("threadId");

-- CreateIndex
CREATE INDEX "ThreadAttachment_replyId_idx" ON "ThreadAttachment"("replyId");

-- CreateIndex
CREATE INDEX "ThreadAttachment_uploadedById_idx" ON "ThreadAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "StudyGroupPostAttachment_postId_idx" ON "StudyGroupPostAttachment"("postId");

-- CreateIndex
CREATE INDEX "StudyGroupPostAttachment_uploadedById_idx" ON "StudyGroupPostAttachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "ThreadAttachment" ADD CONSTRAINT "ThreadAttachment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadAttachment" ADD CONSTRAINT "ThreadAttachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ThreadReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadAttachment" ADD CONSTRAINT "ThreadAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupPostAttachment" ADD CONSTRAINT "StudyGroupPostAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "StudyGroupPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupPostAttachment" ADD CONSTRAINT "StudyGroupPostAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
