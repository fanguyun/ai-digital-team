-- CreateTable
CREATE TABLE "RoleEvaluation" (
    "id" UUID NOT NULL,
    "agentSlug" VARCHAR(120) NOT NULL,
    "agentName" VARCHAR(120) NOT NULL,
    "projectKey" VARCHAR(60) NOT NULL DEFAULT 'digital-team',
    "projectRoot" VARCHAR(300) NOT NULL,
    "tool" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "sessionId" VARCHAR(200),
    "pid" INTEGER,
    "reportPath" VARCHAR(300) NOT NULL,
    "logPath" VARCHAR(300) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RoleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleEvaluation_projectKey_agentSlug_startedAt_idx" ON "RoleEvaluation"("projectKey", "agentSlug", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "RoleEvaluation_status_startedAt_idx" ON "RoleEvaluation"("status", "startedAt" DESC);
