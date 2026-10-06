-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('COMPULSORY', 'OPTIONAL');

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" "SubjectType" NOT NULL DEFAULT 'COMPULSORY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE INDEX "Subject_parentId_idx" ON "Subject"("parentId");

-- CreateIndex
CREATE INDEX "ClassSubject_schoolId_idx" ON "ClassSubject"("schoolId");

-- CreateIndex
CREATE INDEX "ClassSubject_academicYearId_classId_idx" ON "ClassSubject"("academicYearId", "classId");

-- CreateIndex
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");

-- CreateIndex
CREATE INDEX "ClassSubject_groupId_idx" ON "ClassSubject"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_academicYearId_classId_subjectId_groupId_key" ON "ClassSubject"("academicYearId", "classId", "subjectId", "groupId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Postgres treats NULLs as distinct, so the unique key above does not stop the same subject
-- twice for the whole class (groupId IS NULL) in one class and year.
CREATE UNIQUE INDEX "ClassSubject_whole_class_unique"
  ON "ClassSubject" ("academicYearId", "classId", "subjectId")
  WHERE "groupId" IS NULL;

-- Subject names and codes, ignoring case: unique among the platform (NCTB) subjects ...
CREATE UNIQUE INDEX "Subject_platform_nameEn_unique" ON "Subject" (lower("nameEn")) WHERE "schoolId" IS NULL;
CREATE UNIQUE INDEX "Subject_platform_nameBn_unique" ON "Subject" (lower("nameBn")) WHERE "schoolId" IS NULL;
CREATE UNIQUE INDEX "Subject_platform_code_unique" ON "Subject" (lower("code")) WHERE "schoolId" IS NULL AND "code" IS NOT NULL;

-- ... and within each school (a clash with a platform subject is checked by the service)
CREATE UNIQUE INDEX "Subject_school_nameEn_unique" ON "Subject" ("schoolId", lower("nameEn")) WHERE "schoolId" IS NOT NULL;
CREATE UNIQUE INDEX "Subject_school_nameBn_unique" ON "Subject" ("schoolId", lower("nameBn")) WHERE "schoolId" IS NOT NULL;
CREATE UNIQUE INDEX "Subject_school_code_unique" ON "Subject" ("schoolId", lower("code")) WHERE "schoolId" IS NOT NULL AND "code" IS NOT NULL;
