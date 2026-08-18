-- Preserve existing done/not-done data as TODO/DONE before dropping the column
ALTER TABLE "Subtask" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'TODO';
UPDATE "Subtask" SET "status" = 'DONE' WHERE "done" = 1;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subtask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subtask" ("id", "name", "status", "createdAt", "taskId") SELECT "id", "name", "status", "createdAt", "taskId" FROM "Subtask";
DROP TABLE "Subtask";
ALTER TABLE "new_Subtask" RENAME TO "Subtask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
