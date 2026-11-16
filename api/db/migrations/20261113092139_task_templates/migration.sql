-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "brief" VARCHAR(4000) NOT NULL,
    "acceptance" VARCHAR(2000) NOT NULL DEFAULT '',
    "agentSlug" VARCHAR(120) NOT NULL,
    "priority" VARCHAR(8) NOT NULL DEFAULT 'P1',
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTemplate_createdAt_idx" ON "TaskTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_name_key" ON "TaskTemplate"("name");
