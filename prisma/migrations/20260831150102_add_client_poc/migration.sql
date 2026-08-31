-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientPocId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientPocId_fkey" FOREIGN KEY ("clientPocId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

