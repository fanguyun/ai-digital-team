-- CreateTable
CREATE TABLE "RagKnowledgeConfig" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" VARCHAR(300) NOT NULL,
    "tokenCipher" VARCHAR(1000),
    "tokenHint" VARCHAR(12),
    "mode" VARCHAR(12) NOT NULL DEFAULT 'optional',
    "timeoutMs" INTEGER NOT NULL DEFAULT 4000,
    "agentSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pathPrefixes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" VARCHAR(120),
    "lastTestAt" TIMESTAMPTZ(3),
    "lastTestStatus" VARCHAR(40),
    "lastTestLatency" INTEGER,

    CONSTRAINT "RagKnowledgeConfig_pkey" PRIMARY KEY ("id")
);
