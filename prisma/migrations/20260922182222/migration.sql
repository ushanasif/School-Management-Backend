/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,academicYearId,classId,name]` on the table `Section` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Section_schoolId_classId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolId_academicYearId_classId_name_key" ON "Section"("schoolId", "academicYearId", "classId", "name");
