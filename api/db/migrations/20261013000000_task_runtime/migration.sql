CREATE TYPE "TaskRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'WAITING_CONFIRMATION',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "TaskRunStage" AS ENUM (
  'INTAKE',
  'PLANNING',
  'EXECUTION',
  'VERIFICATION',
  'DELIVERY'
);

CREATE TABLE "TaskRun" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "platform" VARCHAR(80) NOT NULL,
  "externalReference" VARCHAR(300),
  "primaryAgent" VARCHAR(160) NOT NULL,
  "status" "TaskRunStatus" NOT NULL DEFAULT 'QUEUED',
  "currentStage" "TaskRunStage" NOT NULL DEFAULT 'INTAKE',
  "summary" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskEvent" (
  "id" UUID NOT NULL,
  "taskRunId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "status" "TaskRunStatus",
  "stage" "TaskRunStage" NOT NULL,
  "agent" VARCHAR(160) NOT NULL,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summary" VARCHAR(1000) NOT NULL,
  "evidence" JSONB,
  "idempotencyKey" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskEvent_idempotencyKey_key" ON "TaskEvent"("idempotencyKey");
CREATE UNIQUE INDEX "TaskEvent_taskRunId_sequence_key" ON "TaskEvent"("taskRunId", "sequence");
CREATE INDEX "TaskRun_status_updatedAt_idx" ON "TaskRun"("status", "updatedAt" DESC);
CREATE INDEX "TaskRun_platform_updatedAt_idx" ON "TaskRun"("platform", "updatedAt" DESC);
CREATE INDEX "TaskRun_primaryAgent_updatedAt_idx" ON "TaskRun"("primaryAgent", "updatedAt" DESC);
CREATE INDEX "TaskRun_updatedAt_id_idx" ON "TaskRun"("updatedAt" DESC, "id" DESC);
CREATE INDEX "TaskEvent_taskRunId_createdAt_idx" ON "TaskEvent"("taskRunId", "createdAt");

ALTER TABLE "TaskEvent"
  ADD CONSTRAINT "TaskEvent_taskRunId_fkey"
  FOREIGN KEY ("taskRunId") REFERENCES "TaskRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
