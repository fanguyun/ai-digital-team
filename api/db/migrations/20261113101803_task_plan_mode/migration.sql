-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "mode" VARCHAR(12) NOT NULL DEFAULT 'auto',
ADD COLUMN     "planPath" VARCHAR(300);

-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "mode" VARCHAR(12) NOT NULL DEFAULT 'auto';
