-- CreateEnum
CREATE TYPE "ResultSystem" AS ENUM ('GRADED', 'MARKS_ONLY');

-- CreateEnum
CREATE TYPE "AbsentRule" AS ENUM ('FAIL', 'EXCLUDE');

-- AlterTable
ALTER TABLE "ClassSubject" ADD COLUMN     "fullMarks" DECIMAL(6,2),
ADD COLUMN     "gradingScaleId" TEXT,
ADD COLUMN     "passMarks" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "GradingScale" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxGpa" DECIMAL(3,2) NOT NULL,
    "failGrade" TEXT NOT NULL DEFAULT 'F',
    "failIfAnyCompulsoryFails" BOOLEAN NOT NULL DEFAULT true,
    "optionalBonusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "optionalBonusThreshold" DECIMAL(3,2) NOT NULL DEFAULT 2.00,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeMarkBand" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "minPercent" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "point" DECIMAL(3,2) NOT NULL,

    CONSTRAINT "GradeMarkBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeGpaBand" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "minGpa" DECIMAL(3,2) NOT NULL,
    "grade" TEXT NOT NULL,

    CONSTRAINT "GradeGpaBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubjectPart" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullMarks" DECIMAL(6,2) NOT NULL,
    "passMarks" DECIMAL(6,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClassSubjectPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassResultSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "resultSystem" "ResultSystem" NOT NULL DEFAULT 'GRADED',
    "gradingScaleId" TEXT,
    "combinePapers" BOOLEAN NOT NULL DEFAULT true,
    "absentRule" "AbsentRule" NOT NULL DEFAULT 'FAIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassResultSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradingScale_schoolId_idx" ON "GradingScale"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScale_schoolId_name_key" ON "GradingScale"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GradeMarkBand_scaleId_minPercent_key" ON "GradeMarkBand"("scaleId", "minPercent");

-- CreateIndex
CREATE UNIQUE INDEX "GradeGpaBand_scaleId_minGpa_key" ON "GradeGpaBand"("scaleId", "minGpa");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubjectPart_classSubjectId_name_key" ON "ClassSubjectPart"("classSubjectId", "name");

-- CreateIndex
CREATE INDEX "ClassResultSetting_schoolId_idx" ON "ClassResultSetting"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassResultSetting_academicYearId_classId_key" ON "ClassResultSetting"("academicYearId", "classId");

-- AddForeignKey
ALTER TABLE "GradingScale" ADD CONSTRAINT "GradingScale_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeMarkBand" ADD CONSTRAINT "GradeMarkBand_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeGpaBand" ADD CONSTRAINT "GradeGpaBand_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubjectPart" ADD CONSTRAINT "ClassSubjectPart_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResultSetting" ADD CONSTRAINT "ClassResultSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResultSetting" ADD CONSTRAINT "ClassResultSetting_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResultSetting" ADD CONSTRAINT "ClassResultSetting_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResultSetting" ADD CONSTRAINT "ClassResultSetting_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

