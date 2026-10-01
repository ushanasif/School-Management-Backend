/*
  Warnings:

  - You are about to drop the column `key` on the `Permission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Permission_key_key";

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "key",
ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
