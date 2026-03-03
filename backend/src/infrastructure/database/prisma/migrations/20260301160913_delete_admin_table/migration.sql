/*
  Warnings:

  - The primary key for the `Alumni` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Alumni` table. All the data in the column will be lost.
  - The primary key for the `Professor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Professor` table. All the data in the column will be lost.
  - The primary key for the `Student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Admin" DROP CONSTRAINT "Admin_userId_fkey";

-- DropIndex
DROP INDEX "Alumni_userId_key";

-- DropIndex
DROP INDEX "Professor_userId_key";

-- DropIndex
DROP INDEX "Student_userId_key";

-- AlterTable
ALTER TABLE "Alumni" DROP CONSTRAINT "Alumni_pkey",
DROP COLUMN "id",
ALTER COLUMN "yearOfGraduation" DROP NOT NULL,
ADD CONSTRAINT "Alumni_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "Professor" DROP CONSTRAINT "Professor_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Professor_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "Student" DROP CONSTRAINT "Student_pkey",
DROP COLUMN "id",
ALTER COLUMN "yearOfGraduation" DROP NOT NULL,
ADD CONSTRAINT "Student_pkey" PRIMARY KEY ("userId");

-- DropTable
DROP TABLE "Admin";
