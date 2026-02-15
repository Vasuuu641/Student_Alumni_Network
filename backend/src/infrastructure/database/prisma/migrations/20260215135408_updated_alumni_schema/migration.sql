/*
  Warnings:

  - The `interests` column on the `Alumni` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `interests` column on the `Student` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `major` to the `Alumni` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearOfGraduation` to the `Alumni` table without a default value. This is not possible if the table is not empty.
  - Made the column `major` on table `Student` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Alumni" ADD COLUMN     "major" TEXT NOT NULL,
ADD COLUMN     "yearOfGraduation" INTEGER NOT NULL,
DROP COLUMN "interests",
ADD COLUMN     "interests" TEXT[];

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "major" SET NOT NULL,
DROP COLUMN "interests",
ADD COLUMN     "interests" TEXT[];
