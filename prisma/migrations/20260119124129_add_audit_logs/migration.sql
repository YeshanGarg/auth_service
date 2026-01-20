/*
  Warnings:

  - The `actorId` column on the `AuditLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `entityId` column on the `AuditLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "actorId",
ADD COLUMN     "actorId" INTEGER,
DROP COLUMN "entityId",
ADD COLUMN     "entityId" INTEGER;

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
