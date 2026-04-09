/*
  Warnings:

  - You are about to drop the column `callJoinUrl` on the `StudyGroupSession` table. All the data in the column will be lost.
  - You are about to drop the column `callProvider` on the `StudyGroupSession` table. All the data in the column will be lost.
  - You are about to drop the column `callRoomId` on the `StudyGroupSession` table. All the data in the column will be lost.
  - You are about to drop the column `isCallEnabled` on the `StudyGroupSession` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GeoHelpSpotReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- DropIndex
DROP INDEX "GeoHelpSpot_city_category_idx";

-- DropIndex
DROP INDEX "GeoHelpSpot_city_visitCount_idx";

-- AlterTable
ALTER TABLE "GeoHelpSpot" ADD COLUMN     "reviewStatus" "GeoHelpSpotReviewStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "StudyGroupSession" DROP COLUMN "callJoinUrl",
DROP COLUMN "callProvider",
DROP COLUMN "callRoomId",
DROP COLUMN "isCallEnabled";

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_category_reviewStatus_idx" ON "GeoHelpSpot"("city", "category", "reviewStatus");

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_visitCount_reviewStatus_idx" ON "GeoHelpSpot"("city", "visitCount", "reviewStatus");
