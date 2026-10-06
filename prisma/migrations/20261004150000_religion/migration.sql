-- Religion becomes a fixed list, on students and on subjects. Written by hand so existing
-- students keep their religion: common spellings (English and Bangla) are converted, and
-- anything not recognised becomes NULL, for an admin to set again.

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('ISLAM', 'HINDUISM', 'CHRISTIANITY', 'BUDDHISM', 'OTHER');

-- AlterTable: convert the free text
ALTER TABLE "Student" ALTER COLUMN "religion" TYPE "Religion" USING (
  CASE
    WHEN lower(trim("religion")) IN ('islam', 'muslim', 'muslims', 'ইসলাম', 'মুসলিম', 'মুসলমান') THEN 'ISLAM'
    WHEN lower(trim("religion")) IN ('hindu', 'hinduism', 'sanatan', 'হিন্দু', 'হিন্দুধর্ম', 'সনাতন') THEN 'HINDUISM'
    WHEN lower(trim("religion")) IN ('christian', 'christianity', 'খ্রিস্টান', 'খ্রিষ্টান', 'খ্রিস্টধর্ম', 'খ্রিষ্টধর্ম') THEN 'CHRISTIANITY'
    WHEN lower(trim("religion")) IN ('buddhist', 'buddhism', 'buddha', 'বৌদ্ধ', 'বৌদ্ধধর্ম') THEN 'BUDDHISM'
    WHEN lower(trim("religion")) IN ('other', 'others', 'অন্যান্য') THEN 'OTHER'
    ELSE NULL
  END
)::"Religion";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN "religion" "Religion";
