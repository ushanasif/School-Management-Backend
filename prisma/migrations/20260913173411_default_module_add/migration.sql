/*
  Warnings:

  - You are about to drop the column `scope` on the `Module` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Module_scope_idx";

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "scope";
