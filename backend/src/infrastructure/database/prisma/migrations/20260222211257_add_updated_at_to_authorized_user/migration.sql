/*
  Warnings:

  - Added the required column `updatedAt` to the `AuthorizedUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuthorizedUser" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
