-- CreateTable
CREATE TABLE "DjuDay" (
    "date" DATETIME NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "tmeanC" REAL NOT NULL,
    "baseC" REAL NOT NULL,
    "dju" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FetchLock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
