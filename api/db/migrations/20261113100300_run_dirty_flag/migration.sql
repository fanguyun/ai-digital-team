-- AlterTable
ALTER TABLE "TaskArtifact" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'item';

-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "dirtyAtDispatch" BOOLEAN NOT NULL DEFAULT false;
