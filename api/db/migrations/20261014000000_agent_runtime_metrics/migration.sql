ALTER TABLE "TaskEvent"
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "cachedTokens" INTEGER,
  ADD COLUMN "modelId" VARCHAR(160);

CREATE INDEX "TaskEvent_agent_createdAt_idx"
  ON "TaskEvent"("agent", "createdAt" DESC);
