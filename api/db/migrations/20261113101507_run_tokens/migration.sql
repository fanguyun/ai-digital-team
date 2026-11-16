-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "cachedTokens" INTEGER,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER;
