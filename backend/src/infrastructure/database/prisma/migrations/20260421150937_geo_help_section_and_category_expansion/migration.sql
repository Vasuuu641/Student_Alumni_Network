/*
  Warnings:

  - The values [STUDY_SPACE,FOOD,TRANSPORT,HOUSING,HEALTH,GYM,LIBRARY] on the enum `GeoHelpSpotCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "GeoHelpSpotSection" AS ENUM ('OFFICIAL_RESOURCE', 'COMMUNITY_PICK');

-- AlterEnum
BEGIN;
CREATE TYPE "GeoHelpSpotCategory_new" AS ENUM ('UNIVERSITY_SERVICE', 'ACADEMIC_DEPARTMENT', 'ADMIN_OFFICE', 'STUDENT_SUPPORT', 'CAMPUS_FACILITY', 'RESTAURANT', 'CAFE', 'STUDY_SPOT', 'SOCIAL_HANGOUT', 'FITNESS_WELLNESS', 'SHOPPING', 'OTHER');
ALTER TABLE "public"."GeoHelpSpot" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "GeoHelpSpot" ALTER COLUMN "category" TYPE "GeoHelpSpotCategory_new" USING ("category"::text::"GeoHelpSpotCategory_new");
ALTER TYPE "GeoHelpSpotCategory" RENAME TO "GeoHelpSpotCategory_old";
ALTER TYPE "GeoHelpSpotCategory_new" RENAME TO "GeoHelpSpotCategory";
DROP TYPE "public"."GeoHelpSpotCategory_old";
ALTER TABLE "GeoHelpSpot" ALTER COLUMN "category" SET DEFAULT 'OTHER';
COMMIT;

-- DropIndex
DROP INDEX "GeoHelpSpot_city_category_reviewStatus_idx";

-- DropIndex
DROP INDEX "GeoHelpSpot_city_visitCount_reviewStatus_idx";

-- AlterTable
ALTER TABLE "GeoHelpSpot" ADD COLUMN     "section" "GeoHelpSpotSection" NOT NULL DEFAULT 'COMMUNITY_PICK';

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_section_category_reviewStatus_idx" ON "GeoHelpSpot"("city", "section", "category", "reviewStatus");

-- CreateIndex
CREATE INDEX "GeoHelpSpot_city_section_visitCount_reviewStatus_idx" ON "GeoHelpSpot"("city", "section", "visitCount", "reviewStatus");
