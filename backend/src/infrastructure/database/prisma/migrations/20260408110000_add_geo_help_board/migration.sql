-- CreateEnum
CREATE TYPE "GeoHelpSpotCategory" AS ENUM ('STUDY_SPACE', 'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'GYM', 'LIBRARY', 'OTHER');

-- CreateTable
CREATE TABLE "GeoHelpSpot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "category" "GeoHelpSpotCategory" NOT NULL DEFAULT 'OTHER',
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoHelpSpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoHelpSpotVisit" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoHelpSpotVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_category_idx" ON "GeoHelpSpot"("city", "category");

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_visitCount_idx" ON "GeoHelpSpot"("city", "visitCount");

-- CreateIndex
CREATE INDEX "GeoHelpSpot_latitude_longitude_idx" ON "GeoHelpSpot"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "GeoHelpSpot_createdById_idx" ON "GeoHelpSpot"("createdById");

-- CreateIndex
CREATE INDEX "GeoHelpSpotVisit_spotId_visitedAt_idx" ON "GeoHelpSpotVisit"("spotId", "visitedAt");

-- CreateIndex
CREATE INDEX "GeoHelpSpotVisit_userId_visitedAt_idx" ON "GeoHelpSpotVisit"("userId", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeoHelpSpotVisit_spotId_userId_key" ON "GeoHelpSpotVisit"("spotId", "userId");

-- AddForeignKey
ALTER TABLE "GeoHelpSpot" ADD CONSTRAINT "GeoHelpSpot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoHelpSpotVisit" ADD CONSTRAINT "GeoHelpSpotVisit_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "GeoHelpSpot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoHelpSpotVisit" ADD CONSTRAINT "GeoHelpSpotVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
