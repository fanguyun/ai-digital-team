-- CreateTable
CREATE TABLE "TaskImage" (
    "id" UUID NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(60) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskImage_createdAt_idx" ON "TaskImage"("createdAt");
