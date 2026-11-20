-- AlterTable
ALTER TABLE "RoleEvaluation" ADD COLUMN     "taskId" UUID;

-- CreateIndex
CREATE INDEX "RoleEvaluation_taskId_idx" ON "RoleEvaluation"("taskId");
