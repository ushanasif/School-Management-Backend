/*
  Warnings:

  - You are about to alter the column `discount` on the `School` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - Added the required column `amount` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthlyFee` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "School" ALTER COLUMN "discount" SET DEFAULT 0,
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "SchoolPayment" ADD COLUMN     "amount" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyFee" DECIMAL(10,2) NOT NULL;
