-- CreateTable
CREATE TABLE "ColdWaterReading" (
    "date" DATETIME NOT NULL PRIMARY KEY,
    "cubicM" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ColdWaterReading_date_idx" ON "ColdWaterReading"("date");
