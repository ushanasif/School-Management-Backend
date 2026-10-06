-- AlterTable
ALTER TABLE "ExamClass" ADD COLUMN     "resultRules" JSONB;

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "examClassId" TEXT NOT NULL,
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

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResultSubject" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "code" TEXT,
    "isOptional" BOOLEAN NOT NULL,
    "isAbsent" BOOLEAN NOT NULL,
    "excluded" BOOLEAN NOT NULL,
    "fullMarks" DECIMAL(6,2) NOT NULL,
    "passMarks" DECIMAL(6,2) NOT NULL,
    "marks" DECIMAL(6,2),
    "percentage" DECIMAL(5,2) NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "grade" TEXT,
    "point" DECIMAL(3,2),
    "parts" JSONB,
    "papers" JSONB,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ExamResultSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamResult_examClassId_sectionId_idx" ON "ExamResult"("examClassId", "sectionId");

-- CreateIndex
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_examClassId_enrollmentId_key" ON "ExamResult"("examClassId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ExamResultSubject_resultId_idx" ON "ExamResultSubject"("resultId");

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examClassId_fkey" FOREIGN KEY ("examClassId") REFERENCES "ExamClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultSubject" ADD CONSTRAINT "ExamResultSubject_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

