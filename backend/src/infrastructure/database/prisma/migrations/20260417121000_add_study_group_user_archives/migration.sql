-- CreateTable
CREATE TABLE "StudyGroupUserArchive" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupUserArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyGroupUserArchive_userId_archivedAt_idx" ON "StudyGroupUserArchive"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupUserArchive_groupId_userId_key" ON "StudyGroupUserArchive"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "StudyGroupUserArchive" ADD CONSTRAINT "StudyGroupUserArchive_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupUserArchive" ADD CONSTRAINT "StudyGroupUserArchive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
