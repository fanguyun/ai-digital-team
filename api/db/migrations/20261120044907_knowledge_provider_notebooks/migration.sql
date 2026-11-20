-- AlterTable
ALTER TABLE "RagKnowledgeConfig" ADD COLUMN     "notebooks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "provider" VARCHAR(16) NOT NULL DEFAULT 'bridge';
