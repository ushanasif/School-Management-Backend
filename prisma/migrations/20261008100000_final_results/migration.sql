-- CreateEnum
CREATE TYPE "FinalComponentMethod" AS ENUM ('AVERAGE', 'BEST');

-- CreateEnum
CREATE TYPE "FinalResultStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "FinalResultFormula" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "attendanceFrom" DATE,
    "attendanceTo" DATE,
    "status" "FinalResultStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "resultRules" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalResultFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalResultComponent" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "method" "FinalComponentMethod" NOT NULL DEFAULT 'AVERAGE',
    "bestCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinalResultComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalResultComponentExam" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,

    CONSTRAINT "FinalResultComponentExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalResult" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "totalMarks" DECIMAL(8,2) NOT NULL,
    "fullMarks" DECIMAL(8,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "gpa" DECIMAL(3,2),
    "grade" TEXT,
    "passed" BOOLEAN NOT NULL,
    "failedSubjects" INTEGER NOT NULL,
    "sectionPosition" INTEGER NOT NULL,
    "classPosition" INTEGER NOT NULL,
    "attendanceDays" INTEGER NOT NULL,
    "attendancePresent" INTEGER NOT NULL,
    "attendanceAbsent" INTEGER NOT NULL,
    "attendanceLeave" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalResultSubject" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "code" TEXT,
    "isOptional" BOOLEAN NOT NULL,
    "excluded" BOOLEAN NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "passPercentage" DECIMAL(5,2) NOT NULL,
    "fullMarks" DECIMAL(6,2) NOT NULL,
    "marks" DECIMAL(6,2),
    "passed" BOOLEAN NOT NULL,
    "grade" TEXT,
    "point" DECIMAL(3,2),
    "components" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "FinalResultSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinalResultFormula_schoolId_idx" ON "FinalResultFormula"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalResultFormula_academicYearId_classId_nameEn_key" ON "FinalResultFormula"("academicYearId", "classId", "nameEn");

-- CreateIndex
CREATE INDEX "FinalResultComponent_formulaId_idx" ON "FinalResultComponent"("formulaId");

-- CreateIndex
CREATE INDEX "FinalResultComponentExam_examId_idx" ON "FinalResultComponentExam"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalResultComponentExam_componentId_examId_key" ON "FinalResultComponentExam"("componentId", "examId");

-- CreateIndex
CREATE INDEX "FinalResult_formulaId_sectionId_idx" ON "FinalResult"("formulaId", "sectionId");

-- CreateIndex
CREATE INDEX "FinalResult_studentId_idx" ON "FinalResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalResult_formulaId_enrollmentId_key" ON "FinalResult"("formulaId", "enrollmentId");

-- CreateIndex
CREATE INDEX "FinalResultSubject_resultId_idx" ON "FinalResultSubject"("resultId");

-- AddForeignKey
ALTER TABLE "FinalResultFormula" ADD CONSTRAINT "FinalResultFormula_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultFormula" ADD CONSTRAINT "FinalResultFormula_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultFormula" ADD CONSTRAINT "FinalResultFormula_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultComponent" ADD CONSTRAINT "FinalResultComponent_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "FinalResultFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultComponentExam" ADD CONSTRAINT "FinalResultComponentExam_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "FinalResultComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultComponentExam" ADD CONSTRAINT "FinalResultComponentExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResult" ADD CONSTRAINT "FinalResult_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "FinalResultFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResult" ADD CONSTRAINT "FinalResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResult" ADD CONSTRAINT "FinalResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResultSubject" ADD CONSTRAINT "FinalResultSubject_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "FinalResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

