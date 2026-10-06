import type { Prisma } from "../../../../generated/prisma/client";
import { endOfBangladeshDay } from "../../shared/scheduleSchemas";

/*
 * Who sits which subject of a class's exam. Shared by marks entry and results.
 *
 * A student sits an exam subject when, on that subject's exam day, they were enrolled in
 * the class (enrolled by then and not yet left), and the subject is theirs:
 *  - a group subject only for that group's students
 *  - a religion subject only for students of that religion
 *  - an optional subject only for the students who chose it as their 4th subject
 */

type Db = Prisma.TransactionClient;

const subjectSelect = {
  id: true,
  date: true,
  fullMarks: true,
  passMarks: true,
  startTime: true,
  endTime: true,
  parts: { orderBy: { sortOrder: "asc" }, select: { name: true, fullMarks: true, passMarks: true } },
  classSubject: {
    select: {
      id: true,
      type: true,
      groupId: true,
      sortOrder: true,
      gradingScaleId: true,
      subject: {
        select: { id: true, nameEn: true, nameBn: true, code: true, religion: true, parentId: true, parent: { select: { id: true, nameEn: true, nameBn: true, code: true } } },
      },
    },
  },
} satisfies Prisma.ExamSubjectSelect;

export type ExamSubjectRow = Prisma.ExamSubjectGetPayload<{ select: typeof subjectSelect }>;

export const loadExamStudents = async (db: Db, examClassId: string, opts: { sectionId?: string } = {}) => {
  const examClass = await db.examClass.findUniqueOrThrow({
    where: { id: examClassId },
    select: {
      id: true,
      classId: true,
      status: true,
      exam: { select: { id: true, academicYearId: true, schoolId: true } },
      subjects: { select: subjectSelect, orderBy: [{ date: "asc" }, { classSubject: { sortOrder: "asc" } }] },
    },
  });
  const subjects = examClass.subjects;
  if (subjects.length === 0) return { examClass, subjects, students: [] };

  const firstDay = new Date(Math.min(...subjects.map((s) => s.date.getTime())));
  const lastDay = new Date(Math.max(...subjects.map((s) => s.date.getTime())));

  const enrollments = await db.enrollment.findMany({
    where: {
      academicYearId: examClass.exam.academicYearId,
      classId: examClass.classId,
      ...(opts.sectionId ? { sectionId: opts.sectionId } : {}),
      enrolledAt: { lt: endOfBangladeshDay(lastDay) },
      OR: [{ status: "ACTIVE" }, { leftAt: { gte: firstDay } }],
    },
    select: {
      id: true,
      rollNumber: true,
      groupId: true,
      status: true,
      enrolledAt: true,
      leftAt: true,
      section: { select: { id: true, name: true, isDefault: true } },
      group: { select: { id: true, nameEn: true, nameBn: true } },
      student: { select: { id: true, nameEn: true, nameBn: true, admissionNo: true, religion: true, photo: true, fatherName: true, motherName: true } },
      optionalSubject: { select: { classSubjectId: true } },
    },
  });

  const takes = (e: (typeof enrollments)[number], s: ExamSubjectRow) => {
    const onRoll =
      e.enrolledAt.getTime() < endOfBangladeshDay(s.date).getTime() &&
      (e.status === "ACTIVE" || (e.leftAt !== null && e.leftAt.getTime() >= s.date.getTime()));
    if (!onRoll) return false;

    const cs = s.classSubject;
    if (cs.groupId !== null && cs.groupId !== e.groupId) return false;
    if (cs.subject.religion !== null && cs.subject.religion !== e.student.religion) return false;
    if (cs.type === "OPTIONAL" && e.optionalSubject?.classSubjectId !== cs.id) return false;
    return true;
  };

  const students = enrollments
    .map((e) => ({
      enrollmentId: e.id,
      rollNumber: e.rollNumber,
      section: e.section,
      group: e.group,
      student: e.student,
      optionalClassSubjectId: e.optionalSubject?.classSubjectId ?? null,
      // the exam subjects this student sits
      examSubjectIds: new Set(subjects.filter((s) => takes(e, s)).map((s) => s.id)),
    }))
    .filter((s) => s.examSubjectIds.size > 0)
    .sort(
      (a, b) =>
        a.section.name.localeCompare(b.section.name) ||
        (a.rollNumber && b.rollNumber
          ? a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
          : a.rollNumber
            ? -1
            : b.rollNumber
              ? 1
              : a.student.nameEn.localeCompare(b.student.nameEn)),
    );

  return { examClass, subjects, students };
};

export type ExamStudents = Awaited<ReturnType<typeof loadExamStudents>>;
