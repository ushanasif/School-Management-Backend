-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SectionYearConfig" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT;

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleOverrideRule" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ScheduleOverrideRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleOverride_schoolId_fromDate_toDate_idx" ON "ScheduleOverride"("schoolId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "ScheduleOverride_academicYearId_idx" ON "ScheduleOverride"("academicYearId");

-- CreateIndex
CREATE INDEX "ScheduleOverrideRule_overrideId_idx" ON "ScheduleOverrideRule"("overrideId");

-- CreateIndex
CREATE INDEX "ScheduleOverrideRule_classId_idx" ON "ScheduleOverrideRule"("classId");

-- CreateIndex
CREATE INDEX "ScheduleOverrideRule_sectionId_idx" ON "ScheduleOverrideRule"("sectionId");

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverrideRule" ADD CONSTRAINT "ScheduleOverrideRule_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "ScheduleOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverrideRule" ADD CONSTRAINT "ScheduleOverrideRule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverrideRule" ADD CONSTRAINT "ScheduleOverrideRule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

