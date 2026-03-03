/*
  Warnings:

  - You are about to drop the column `anonymousName` on the `Alumni` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `Alumni` table. All the data in the column will be lost.
  - You are about to drop the column `yearOfGraduation` on the `Alumni` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `Professor` table. All the data in the column will be lost.
  - You are about to drop the column `yearOfGraduation` on the `Student` table. All the data in the column will be lost.
  - Added the required column `job_title` to the `Professor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Alumni" DROP COLUMN "anonymousName",
DROP COLUMN "jobTitle",
DROP COLUMN "yearOfGraduation",
ADD COLUMN     "anonymous_name" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "year_of_graduation" INTEGER,
ALTER COLUMN "major" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "jobTitle",
ADD COLUMN     "job_title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "yearOfGraduation",
ADD COLUMN     "year_of_graduation" INTEGER;
