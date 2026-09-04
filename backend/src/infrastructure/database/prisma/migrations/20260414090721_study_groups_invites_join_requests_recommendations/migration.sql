-- AlterTable
ALTER TABLE "StudyGroup" ADD COLUMN     "recommendedGroups" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "StudyGroupJoinRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyGroupJoinRequest_groupId_idx" ON "StudyGroupJoinRequest"("groupId");

-- CreateIndex
CREATE INDEX "StudyGroupJoinRequest_userId_idx" ON "StudyGroupJoinRequest"("userId");

-- AddForeignKey
ALTER TABLE "StudyGroupJoinRequest" ADD CONSTRAINT "StudyGroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupJoinRequest" ADD CONSTRAINT "StudyGroupJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
