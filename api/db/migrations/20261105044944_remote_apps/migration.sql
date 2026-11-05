-- CreateTable
CREATE TABLE "RemoteApp" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "icon" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RemoteApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteApp_createdAt_idx" ON "RemoteApp"("createdAt");
