CREATE TABLE "KnowledgePublication" (
  "id" UUID NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "targetKey" VARCHAR(64) NOT NULL,
  "taskId" UUID,
  "artifactId" UUID,
  "createdBy" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "markdown" TEXT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "sourceFingerprint" VARCHAR(64) NOT NULL,
  "notebookId" VARCHAR(32) NOT NULL,
  "documentPath" VARCHAR(500) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PREPARED',
  "documentId" VARCHAR(32),
  "error" VARCHAR(500),
  "confirmedAt" TIMESTAMPTZ(3),
  "attemptedAt" TIMESTAMPTZ(3),
  "verifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "KnowledgePublication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgePublication_requestKey_key" ON "KnowledgePublication"("requestKey");
CREATE UNIQUE INDEX "KnowledgePublication_targetKey_key" ON "KnowledgePublication"("targetKey");
CREATE INDEX "KnowledgePublication_taskId_createdAt_idx" ON "KnowledgePublication"("taskId", "createdAt" DESC);
CREATE INDEX "KnowledgePublication_createdBy_createdAt_idx" ON "KnowledgePublication"("createdBy", "createdAt" DESC);
