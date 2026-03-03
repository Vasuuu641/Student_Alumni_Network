-- AlterTable
ALTER TABLE "Alumni" ADD COLUMN     "anonymousName" TEXT,
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profilePictureUrl" TEXT;

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "profilePictureUrl" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "profilePictureUrl" TEXT;
