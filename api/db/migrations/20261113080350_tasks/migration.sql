-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "taskId" UUID;

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "brief" VARCHAR(4000) NOT NULL,
    "acceptance" VARCHAR(2000) NOT NULL,
    "agentSlug" VARCHAR(120) NOT NULL,
    "priority" VARCHAR(8) NOT NULL DEFAULT 'P1',
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskArtifact" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_status_updatedAt_idx" ON "Task"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Task_agentSlug_updatedAt_idx" ON "Task"("agentSlug", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "TaskArtifact_taskId_createdAt_idx" ON "TaskArtifact"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskRun_taskId_startedAt_idx" ON "TaskRun"("taskId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskArtifact" ADD CONSTRAINT "TaskArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
