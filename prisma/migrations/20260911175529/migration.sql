/*
  Warnings:

  - Added the required column `scope` to the `Module` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModuleScope" AS ENUM ('PLATFORM', 'SCHOOL');

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "scope" "ModuleScope" NOT NULL;

-- CreateIndex
CREATE INDEX "Module_scope_idx" ON "Module"("scope");

-- CreateIndex
CREATE INDEX "Module_isActive_idx" ON "Module"("isActive");

-- CreateIndex
CREATE INDEX "Permission_isActive_idx" ON "Permission"("isActive");

-- CreateIndex
CREATE INDEX "SchoolModule_isEnabled_idx" ON "SchoolModule"("isEnabled");
