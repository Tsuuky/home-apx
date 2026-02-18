-- AlterTable
ALTER TABLE "PelletDaily" ADD COLUMN "pricePerBag" REAL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "pricePerBag" REAL;

-- CreateTable
CREATE TABLE "ColdWaterPricePeriod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "pricePerM3" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ColdWaterPricePeriod_startDate_endDate_idx" ON "ColdWaterPricePeriod"("startDate", "endDate");
