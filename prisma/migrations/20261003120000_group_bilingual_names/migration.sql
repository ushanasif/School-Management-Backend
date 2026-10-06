-- Group gets an English and a Bangla name. Written by hand so existing groups keep their
-- name: "name" is renamed to "nameEn", and "nameBn" starts as a copy of it (edit it later).

-- DropIndex
DROP INDEX "Group_name_idx";

-- DropIndex
DROP INDEX "Group_schoolId_name_key";

-- AlterTable
ALTER TABLE "Group" RENAME COLUMN "name" TO "nameEn";
ALTER TABLE "Group" ADD COLUMN "nameBn" TEXT;
UPDATE "Group" SET "nameBn" = "nameEn";
ALTER TABLE "Group" ALTER COLUMN "nameBn" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Group_schoolId_idx" ON "Group"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_schoolId_nameEn_key" ON "Group"("schoolId", "nameEn");

-- Names are unique per school ignoring case ("science" and "Science" clash)
CREATE UNIQUE INDEX "Group_school_nameEn_ci_unique" ON "Group" ("schoolId", lower("nameEn"));
CREATE UNIQUE INDEX "Group_school_nameBn_ci_unique" ON "Group" ("schoolId", lower("nameBn"));
