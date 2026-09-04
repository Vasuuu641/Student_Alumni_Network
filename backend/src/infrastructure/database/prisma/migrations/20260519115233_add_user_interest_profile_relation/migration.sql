-- CreateEnum
CREATE TYPE "InterestSignalType" AS ENUM ('THREAD_VIEW', 'THREAD_OPEN', 'THREAD_REPLY', 'THREAD_LIKE', 'THREAD_SAVE', 'GEO_VIEW', 'GEO_VISIT', 'GEO_SAVE', 'CATEGORY_BROWSE', 'PANEL_FOCUS');

-- CreateTable
CREATE TABLE "UserInterestProfile" (
    "userId" TEXT NOT NULL,
    "academicWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "alumniWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "careerWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "housingWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "shoppingWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "internshipWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInterestProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserInterestSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InterestSignalType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourcePanel" TEXT,
    "sourceModule" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterestSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCandidate" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "actionUrl" TEXT,
    "dedupeKey" TEXT,
    "metadataJson" JSONB,
    "rawScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoringReason" TEXT,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserInterestProfile_lastUpdatedAt_idx" ON "UserInterestProfile"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "UserInterestSignal_userId_createdAt_idx" ON "UserInterestSignal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserInterestSignal_entityType_entityId_idx" ON "UserInterestSignal"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "UserInterestSignal_type_userId_idx" ON "UserInterestSignal"("type", "userId");

-- CreateIndex
CREATE INDEX "NotificationCandidate_userId_isEligible_createdAt_idx" ON "NotificationCandidate"("userId", "isEligible", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationCandidate_expiresAt_idx" ON "NotificationCandidate"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserInterestProfile" ADD CONSTRAINT "UserInterestProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterestSignal" ADD CONSTRAINT "UserInterestSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserInterestProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
