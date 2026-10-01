/*
  Warnings:

  - You are about to drop the column `academicYearId` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `Section` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[schoolId,classId,name]` on the table `Section` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_academicYearId_fkey";

-- DropIndex
DROP INDEX "Section_schoolId_academicYearId_classId_name_key";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "academicYearId",
DROP COLUMN "capacity";

-- CreateTable
CREATE TABLE "SectionYearConfig" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classTeacherMembershipId" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionYearConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionYearConfig_sectionId_idx" ON "SectionYearConfig"("sectionId");

-- CreateIndex
CREATE INDEX "SectionYearConfig_academicYearId_idx" ON "SectionYearConfig"("academicYearId");

-- CreateIndex
CREATE INDEX "SectionYearConfig_classTeacherMembershipId_idx" ON "SectionYearConfig"("classTeacherMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionYearConfig_sectionId_academicYearId_key" ON "SectionYearConfig"("sectionId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolId_classId_name_key" ON "Section"("schoolId", "classId", "name");

-- AddForeignKey
ALTER TABLE "SectionYearConfig" ADD CONSTRAINT "SectionYearConfig_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionYearConfig" ADD CONSTRAINT "SectionYearConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionYearConfig" ADD CONSTRAINT "SectionYearConfig_classTeacherMembershipId_fkey" FOREIGN KEY ("classTeacherMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
