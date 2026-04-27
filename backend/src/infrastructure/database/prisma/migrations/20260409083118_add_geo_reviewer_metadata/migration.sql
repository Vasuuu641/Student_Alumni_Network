-- AlterTable
ALTER TABLE "GeoHelpSpot" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateIndex
CREATE INDEX "GeoHelpSpot_reviewedById_reviewedAt_idx" ON "GeoHelpSpot"("reviewedById", "reviewedAt");

-- AddForeignKey
ALTER TABLE "GeoHelpSpot" ADD CONSTRAINT "GeoHelpSpot_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
