-- CreateEnum
CREATE TYPE "CalendarEntryKind" AS ENUM ('HOLIDAY', 'WORKING_DAY');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('PUBLIC', 'SCHOOL', 'VACATION');

-- CreateTable
CREATE TABLE "WeeklyHolidayRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "weekdays" INTEGER[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyHolidayRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationalHoliday" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "description" TEXT,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NationalHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationalHolidayExclusion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nationalHolidayId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NationalHolidayExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "kind" "CalendarEntryKind" NOT NULL,
    "type" "HolidayType",
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "description" TEXT,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "allClasses" BOOLEAN NOT NULL DEFAULT true,
    "teachersOff" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEntryClass" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "CalendarEntryClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyHolidayRule_schoolId_effectiveFrom_key" ON "WeeklyHolidayRule"("schoolId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NationalHoliday_fromDate_toDate_idx" ON "NationalHoliday"("fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "NationalHolidayExclusion_schoolId_nationalHolidayId_key" ON "NationalHolidayExclusion"("schoolId", "nationalHolidayId");

-- CreateIndex
CREATE INDEX "CalendarEntry_schoolId_fromDate_toDate_idx" ON "CalendarEntry"("schoolId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "CalendarEntry_academicYearId_idx" ON "CalendarEntry"("academicYearId");

-- CreateIndex
CREATE INDEX "CalendarEntryClass_classId_idx" ON "CalendarEntryClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEntryClass_entryId_classId_key" ON "CalendarEntryClass"("entryId", "classId");

-- AddForeignKey
ALTER TABLE "WeeklyHolidayRule" ADD CONSTRAINT "WeeklyHolidayRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalHolidayExclusion" ADD CONSTRAINT "NationalHolidayExclusion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalHolidayExclusion" ADD CONSTRAINT "NationalHolidayExclusion_nationalHolidayId_fkey" FOREIGN KEY ("nationalHolidayId") REFERENCES "NationalHoliday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntryClass" ADD CONSTRAINT "CalendarEntryClass_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CalendarEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntryClass" ADD CONSTRAINT "CalendarEntryClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

