/*
  Warnings:

  - You are about to drop the column `profilePictureUrl` on the `Alumni` table. All the data in the column will be lost.
  - You are about to drop the column `profilePictureUrl` on the `Professor` table. All the data in the column will be lost.
  - You are about to drop the column `profilePictureUrl` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Alumni" DROP COLUMN "profilePictureUrl",
ADD COLUMN     "profile_picture_url" TEXT;

-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "profilePictureUrl",
ADD COLUMN     "profile_picture_url" TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "profilePictureUrl",
ADD COLUMN     "profile_picture_url" TEXT;
