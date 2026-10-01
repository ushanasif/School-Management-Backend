/*
  Warnings:

  - You are about to drop the column `amount` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paidForMonth` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paidForYear` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentCode` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `receivedByUserId` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `transactionNo` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `userCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `SchoolBilling` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[schoolId,year,month]` on the table `SchoolPayment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `month` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SchoolPaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- DropForeignKey
ALTER TABLE "SchoolBilling" DROP CONSTRAINT "SchoolBilling_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolPayment" DROP CONSTRAINT "SchoolPayment_receivedByUserId_fkey";

-- DropIndex
DROP INDEX "SchoolPayment_paidForYear_paidForMonth_idx";

-- DropIndex
DROP INDEX "SchoolPayment_paymentCode_key";

-- DropIndex
DROP INDEX "SchoolPayment_paymentDate_idx";

-- DropIndex
DROP INDEX "User_userCode_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "activationDate" TIMESTAMP(3),
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyFee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "SchoolPayment" DROP COLUMN "amount",
DROP COLUMN "paidForMonth",
DROP COLUMN "paidForYear",
DROP COLUMN "paymentCode",
DROP COLUMN "paymentDate",
DROP COLUMN "paymentMethod",
DROP COLUMN "receivedByUserId",
DROP COLUMN "transactionNo",
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "status" "SchoolPaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "userCode",
DROP COLUMN "username";

-- DropTable
DROP TABLE "SchoolBilling";

-- DropEnum
DROP TYPE "PaymentMethod";

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayment_schoolId_year_month_key" ON "SchoolPayment"("schoolId", "year", "month");
