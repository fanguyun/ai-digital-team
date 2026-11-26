CREATE TABLE "TaskWorkflow" (
  "id" UUID NOT NULL, "taskId" UUID NOT NULL, "runId" UUID,
  "templateKey" VARCHAR(80) NOT NULL, "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "definition" JSONB NOT NULL, "input" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT', "currentStep" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1, "reworkCount" INTEGER NOT NULL DEFAULT 0,
  "tool" VARCHAR(40) NOT NULL DEFAULT 'codex', "note" VARCHAR(2000), "publicationId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "TaskWorkflow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskWorkflow_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "TaskWorkflow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TaskRun"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "TaskWorkflow_taskId_key" ON "TaskWorkflow"("taskId");
CREATE UNIQUE INDEX "TaskWorkflow_runId_key" ON "TaskWorkflow"("runId");
CREATE INDEX "TaskWorkflow_status_updatedAt_idx" ON "TaskWorkflow"("status", "updatedAt");
CREATE TABLE "WorkflowStep" (
  "id" UUID NOT NULL, "workflowId" UUID NOT NULL, "ordinal" INTEGER NOT NULL,
  "key" VARCHAR(60) NOT NULL, "name" VARCHAR(100) NOT NULL, "kind" VARCHAR(16) NOT NULL,
  "agentSlug" VARCHAR(120) NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "TaskWorkflow"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "WorkflowStep_workflowId_ordinal_key" ON "WorkflowStep"("workflowId", "ordinal");
CREATE TABLE "WorkflowAttempt" (
  "id" UUID NOT NULL, "stepId" UUID NOT NULL, "number" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED', "pid" INTEGER, "logPath" VARCHAR(500), "sessionId" VARCHAR(200),
  "input" JSONB NOT NULL, "output" JSONB, "artifactId" UUID, "contentHash" VARCHAR(64), "error" VARCHAR(2000),
  "inputTokens" INTEGER, "outputTokens" INTEGER, "cachedTokens" INTEGER,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMPTZ(3),
  CONSTRAINT "WorkflowAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowAttempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "WorkflowAttempt_stepId_number_key" ON "WorkflowAttempt"("stepId", "number");
CREATE INDEX "WorkflowAttempt_sessionId_idx" ON "WorkflowAttempt"("sessionId");
CREATE INDEX "WorkflowAttempt_status_startedAt_idx" ON "WorkflowAttempt"("status", "startedAt");
