/*
  Warnings:

  - Added the required column `sequence` to the `DocumentVersion` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DocumentVersion" ("createdAt", "documentId", "fileName", "filePath", "id", "remarks", "uploadedById", "version") SELECT "createdAt", "documentId", "fileName", "filePath", "id", "remarks", "uploadedById", "version" FROM "DocumentVersion";
DROP TABLE "DocumentVersion";
ALTER TABLE "new_DocumentVersion" RENAME TO "DocumentVersion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
