-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "reviewNote" VARCHAR(2000),
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3);
