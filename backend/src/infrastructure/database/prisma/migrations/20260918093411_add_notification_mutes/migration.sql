-- CreateEnum
CREATE TYPE "NotificationMuteScope" AS ENUM ('ENTITY', 'CATEGORY');

-- CreateTable
CREATE TABLE "NotificationMute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "NotificationMuteScope" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "category" TEXT,
    "sourceModule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationMute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationMute_userId_entityType_entityId_idx" ON "NotificationMute"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "NotificationMute_userId_sourceModule_category_idx" ON "NotificationMute"("userId", "sourceModule", "category");

-- AddForeignKey
ALTER TABLE "NotificationMute" ADD CONSTRAINT "NotificationMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
