-- CreateEnum
CREATE TYPE "studyGroupsVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "studyGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "studyGroupMemberRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "studyGroupJoinStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED', 'PENDING');

-- CreateEnum
CREATE TYPE "studyGroupPostStatus" AS ENUM ('ACTIVE', 'EDITED', 'DELETED');

-- CreateTable
CREATE TABLE "StudyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visibility" "studyGroupsVisibility" NOT NULL,
    "status" "studyGroupStatus" NOT NULL,
    "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxMembers" INTEGER,
    "ownerId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "studyGroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinStatus" "studyGroupJoinStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "StudyGroupPost" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "studyGroupPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroupPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupSession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL,
    "location" TEXT,
    "isCallEnabled" BOOLEAN NOT NULL DEFAULT false,
    "callProvider" TEXT,
    "callRoomId" TEXT,
    "callJoinUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupAuditEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGroupAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyGroup_status_visibility_lastActivityAt_idx" ON "StudyGroup"("status", "visibility", "lastActivityAt");

-- CreateIndex
CREATE INDEX "StudyGroup_ownerId_idx" ON "StudyGroup"("ownerId");

-- CreateIndex
CREATE INDEX "StudyGroupMember_userId_joinStatus_idx" ON "StudyGroupMember"("userId", "joinStatus");

-- CreateIndex
CREATE INDEX "StudyGroupMember_groupId_role_idx" ON "StudyGroupMember"("groupId", "role");

-- CreateIndex
CREATE INDEX "StudyGroupPost_groupId_createdAt_idx" ON "StudyGroupPost"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyGroupPost_authorId_idx" ON "StudyGroupPost"("authorId");

-- CreateIndex
CREATE INDEX "StudyGroupSession_groupId_startsAt_idx" ON "StudyGroupSession"("groupId", "startsAt");

-- CreateIndex
CREATE INDEX "StudyGroupSession_createdBy_idx" ON "StudyGroupSession"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupInvite_token_key" ON "StudyGroupInvite"("token");

-- CreateIndex
CREATE INDEX "StudyGroupInvite_groupId_expiresAt_idx" ON "StudyGroupInvite"("groupId", "expiresAt");

-- CreateIndex
CREATE INDEX "StudyGroupInvite_invitedUserId_idx" ON "StudyGroupInvite"("invitedUserId");

-- CreateIndex
CREATE INDEX "StudyGroupAuditEvent_groupId_createdAt_idx" ON "StudyGroupAuditEvent"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyGroupAuditEvent_actorId_idx" ON "StudyGroupAuditEvent"("actorId");

-- AddForeignKey
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupPost" ADD CONSTRAINT "StudyGroupPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupPost" ADD CONSTRAINT "StudyGroupPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupSession" ADD CONSTRAINT "StudyGroupSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupSession" ADD CONSTRAINT "StudyGroupSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupInvite" ADD CONSTRAINT "StudyGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupInvite" ADD CONSTRAINT "StudyGroupInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupInvite" ADD CONSTRAINT "StudyGroupInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupAuditEvent" ADD CONSTRAINT "StudyGroupAuditEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupAuditEvent" ADD CONSTRAINT "StudyGroupAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
