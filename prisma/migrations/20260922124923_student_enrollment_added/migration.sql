/*
  Warnings:

  - You are about to drop the column `isActive` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `schoolId` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `name_bn` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `fullAddress` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `name_bn` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `regNo` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `schooldId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `studentCode` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `ClassName` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentClass` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[studentId,academicYearId]` on the table `Enrollment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,name]` on the table `Group` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,classId,name]` on the table `Section` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,nameEn,nameBn,fatherName]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,admissionNo]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classId` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEn` to the `School` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `School` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `academicYearId` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classId` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `admissionNo` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameBn` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEn` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolId` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- DropForeignKey
ALTER TABLE "StudentClass" DROP CONSTRAINT "StudentClass_enrollId_fkey";

-- DropIndex
DROP INDEX "AcademicYear_schoolId_isActive_idx";

-- DropIndex
DROP INDEX "Student_schooldId_name_en_name_bn_fatherName_key";

-- DropIndex
DROP INDEX "Student_schooldId_regNo_key";

-- AlterTable
ALTER TABLE "AcademicYear" DROP COLUMN "isActive",
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "schoolId",
ADD COLUMN     "academicYearId" TEXT NOT NULL,
ADD COLUMN     "classId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "leftAt" TIMESTAMP(3),
ADD COLUMN     "rollNumber" TEXT,
ADD COLUMN     "sectionId" TEXT NOT NULL,
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "School" DROP COLUMN "name_bn",
DROP COLUMN "name_en",
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "academicYearId" TEXT NOT NULL,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "classId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "district",
DROP COLUMN "fullAddress",
DROP COLUMN "name_bn",
DROP COLUMN "name_en",
DROP COLUMN "regNo",
DROP COLUMN "schooldId",
DROP COLUMN "studentCode",
ADD COLUMN     "admissionNo" TEXT NOT NULL,
ADD COLUMN     "nameBn" TEXT NOT NULL,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "permanentAddress" TEXT,
ADD COLUMN     "presentAddress" TEXT,
ADD COLUMN     "schoolId" TEXT NOT NULL,
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "whatsApp" TEXT,
ALTER COLUMN "dob" DROP NOT NULL,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender" NOT NULL;

-- DropTable
DROP TABLE "ClassName";

-- DropTable
DROP TABLE "StudentClass";

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numericLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_numericLevel_idx" ON "SchoolClass"("schoolId", "numericLevel");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name");

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_isCurrent_idx" ON "AcademicYear"("schoolId", "isCurrent");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_academicYearId_idx" ON "Enrollment"("academicYearId");

-- CreateIndex
CREATE INDEX "Enrollment_classId_idx" ON "Enrollment"("classId");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_academicYearId_classId_sectionId_idx" ON "Enrollment"("academicYearId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key" ON "Enrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "Group_name_idx" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_schoolId_name_key" ON "Group"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Section_schoolId_idx" ON "Section"("schoolId");

-- CreateIndex
CREATE INDEX "Section_classId_idx" ON "Section"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolId_classId_name_key" ON "Section"("schoolId", "classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_nameEn_nameBn_fatherName_key" ON "Student"("schoolId", "nameEn", "nameBn", "fatherName");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_admissionNo_key" ON "Student"("schoolId", "admissionNo");

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
