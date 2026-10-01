/*
  Warnings:

  - You are about to drop the column `isDefault` on the `Module` table. All the data in the column will be lost.
  - You are about to drop the column `disabledAt` on the `SchoolModule` table. All the data in the column will be lost.
  - You are about to drop the column `enabledAt` on the `SchoolModule` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "isDefault",
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "type" "ModuleType" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "SchoolModule" DROP COLUMN "disabledAt",
DROP COLUMN "enabledAt";

-- DropEnum
DROP TYPE "ModuleScope";

-- CreateIndex
CREATE INDEX "Module_type_idx" ON "Module"("type");
