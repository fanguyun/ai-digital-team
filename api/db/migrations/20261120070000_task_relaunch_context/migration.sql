-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "dispatchContext" JSONB,
ADD COLUMN     "projectKey" VARCHAR(60),
ADD COLUMN     "projectName" VARCHAR(120);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "pendingDispatch" JSONB;

-- AlterTable
ALTER TABLE "TaskArtifact" ADD COLUMN     "lastRunId" UUID;

-- CreateIndex
CREATE INDEX "TaskArtifact_lastRunId_idx" ON "TaskArtifact"("lastRunId");

-- AddForeignKey
ALTER TABLE "TaskArtifact" ADD CONSTRAINT "TaskArtifact_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "TaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

