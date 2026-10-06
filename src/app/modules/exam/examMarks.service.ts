import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { checkPermission } from "../../middlewares/authorize";
import { dayKey, todayInBangladesh } from "../../shared/scheduleSchemas";
import { WORKING_STATUSES } from "../teacher/teacher.service";
import { type ExamSubjectRow, loadExamStudents } from "./examStudents";
import type {
  GridQuery,
  MarkEntry,
  MineQuery,
  ProgressQuery,
  SaveGridPayload,
  SaveSheetPayload,
  SaveStudentPayload,
  SheetQuery,
  StudentQuery,
} from "./examMarks.validation";

type Auth = NonNullable<Express.Request["auth"]>;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

// ------------------------------------------------------------------- helpers

/* Admins with exam:enter_marks may enter any section; a subject teacher only their own. */
const canEnterMarks = async (auth: Auth, sectionId: string, classSubjectId: string) => {
  if ((await checkPermission(auth, "exam:enter_marks")) === "OK") return true;
  if (!auth.membershipId) return false;

  const assigned = await prisma.subjectTeacher.findFirst({
    where: {
      sectionId,
      classSubjectId,
      teacher: { membershipId: auth.membershipId, status: { in: WORKING_STATUSES } },
    },
    select: { id: true },
  });
  return assigned !== null;
};

/* The exam subject and section of a marks sheet, checked to belong together and to the school. */
const loadSheetContext = async (schoolId: string, examSubjectId: string, sectionId: string) => {
  const examSubject = await prisma.examSubject.findFirst({
    where: { id: examSubjectId, examClass: { exam: { schoolId } } },
    select: {
      id: true,
      date: true,
      fullMarks: true,
      passMarks: true,
      classSubjectId: true,
      parts: { orderBy: { sortOrder: "asc" }, select: { name: true, fullMarks: true, passMarks: true } },
      classSubject: { select: { subject: { select: { id: true, nameEn: true, nameBn: true, code: true } } } },
      examClass: {
        select: {
          id: true,
          status: true,
          classId: true,
          class: { select: { id: true, name: true } },
          exam: { select: { id: true, nameEn: true, nameBn: true } },
        },
      },
    },
  });
  if (!examSubject) throw new AppError("Exam subject not found", httpStatus.NOT_FOUND);

  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId, classId: examSubject.examClass.classId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!section) throw new AppError("Section not found in this class", httpStatus.NOT_FOUND);

  return { examSubject, section };
};

type Context = Awaited<ReturnType<typeof loadSheetContext>>;

/* Why marks cannot be entered right now (null = they can). */
const entryBlocker = (ctx: Context) => {
  if (ctx.examSubject.examClass.status === "ROUTINE") return "Marks entry has not been opened for this class yet";
  if (ctx.examSubject.examClass.status === "PUBLISHED") return "The result is published and marks are locked";
  if (ctx.examSubject.date.getTime() > todayInBangladesh().getTime()) {
    return `Marks can be entered from the exam day (${dayKey(ctx.examSubject.date)})`;
  }
  return null;
};

/* The section's students who sit this subject. */
const studentsOfSheet = async (ctx: Context) => {
  const { students } = await loadExamStudents(prisma, ctx.examSubject.examClass.id, { sectionId: ctx.section.id });
  return students.filter((s) => s.examSubjectIds.has(ctx.examSubject.id));
};

type SubjectMarks = {
  fullMarks: Prisma.Decimal;
  parts: { name: string; fullMarks: Prisma.Decimal }[];
  classSubject?: { subject: { nameEn: string } };
};

/*
 * Checks one mark against its subject and works out the total: every part within its
 * full marks (total = their sum), or the total within the full marks. Absent = no marks.
 */
const checkMark = (subject: SubjectMarks, m: MarkEntry, who: string) => {
  const label = subject.classSubject ? `${who}, ${subject.classSubject.subject.nameEn}` : who;
  if (m.isAbsent) return { isAbsent: true, partMarks: null, total: null };

  const { parts, fullMarks } = subject;
  if (parts.length > 0) {
    const names = parts.map((p) => p.name);
    if (!m.parts) throw new AppError(`${label}: enter the marks of each part (${names.join(", ")})`, httpStatus.BAD_REQUEST);
    if (Object.keys(m.parts).length !== names.length || names.some((n) => !(n in m.parts!))) {
      throw new AppError(`${label}: enter exactly these parts: ${names.join(", ")}`, httpStatus.BAD_REQUEST);
    }
    for (const p of parts) {
      if (m.parts[p.name] > Number(p.fullMarks)) {
        throw new AppError(`${label}: ${p.name} cannot be more than ${p.fullMarks}`, httpStatus.BAD_REQUEST);
      }
    }
    const total = Math.round(Object.values(m.parts).reduce((sum, v) => sum + v, 0) * 100) / 100;
    return { isAbsent: false, partMarks: m.parts, total };
  }

  if (m.parts) throw new AppError(`${label}: this subject has no parts, enter the total`, httpStatus.BAD_REQUEST);
  if (m.total! > Number(fullMarks)) {
    throw new AppError(`${label}: marks cannot be more than ${fullMarks}`, httpStatus.BAD_REQUEST);
  }
  return { isAbsent: false, partMarks: null, total: m.total! };
};

type MarkRow = ReturnType<typeof checkMark> & { examSubjectId: string; enrollmentId: string; studentId: string };

/* Saves checked marks, all or nothing. Saving again replaces a mark. */
const writeMarks = async (userId: string, rows: MarkRow[]) => {
  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        const values = {
          isAbsent: row.isAbsent,
          // DbNull stores SQL NULL in a Json column (a plain null is not allowed there)
          partMarks: row.partMarks ?? Prisma.DbNull,
          total: row.total,
          enteredBy: userId,
        };
        await tx.examMark.upsert({
          where: { examSubjectId_enrollmentId: { examSubjectId: row.examSubjectId, enrollmentId: row.enrollmentId } },
          create: { examSubjectId: row.examSubjectId, enrollmentId: row.enrollmentId, studentId: row.studentId, ...values },
          update: values,
        });
      }
    },
    // a whole section grid can be a few thousand marks
    { ...TX_OPTIONS, timeout: 60_000 },
  );
};

/* The exam's class (for the grid and student screens), with why its marks cannot be entered now. */
const findExamClass = async (schoolId: string, examId: string, classId: string) => {
  const examClass = await prisma.examClass.findFirst({
    where: { examId, classId, exam: { schoolId } },
    select: {
      id: true,
      status: true,
      class: { select: { id: true, name: true } },
      exam: { select: { id: true, nameEn: true, nameBn: true, academicYearId: true } },
    },
  });
  if (!examClass) throw new AppError("This class is not part of the exam", httpStatus.NOT_FOUND);
  return examClass;
};

const classBlocker = (status: string) =>
  status === "ROUTINE"
    ? "Marks entry has not been opened for this class yet"
    : status === "PUBLISHED"
      ? "The result is published and marks are locked"
      : null;

/* A subject's marks open on its exam day. */
const isOpen = (date: Date) => date.getTime() <= todayInBangladesh().getTime();

const subjectColumn = (s: ExamSubjectRow) => ({
  examSubjectId: s.id,
  subject: s.classSubject.subject,
  type: s.classSubject.type,
  date: dayKey(s.date),
  open: isOpen(s.date),
  fullMarks: s.fullMarks,
  passMarks: s.passMarks,
  parts: s.parts,
});

const markCell = (mark: { isAbsent: boolean; partMarks: unknown; total: Prisma.Decimal | null } | undefined) =>
  mark ? { entered: true, isAbsent: mark.isAbsent, parts: (mark.partMarks as Record<string, number> | null) ?? null, total: mark.total } : { entered: false, isAbsent: false, parts: null, total: null };

// ---------------------------------------------------------------- marks sheet

/* The marks sheet of one subject in one section: who sits it, and their marks so far. */
const getSheet = async (auth: Auth, query: SheetQuery) => {
  const ctx = await loadSheetContext(auth.schoolId!, query.examSubjectId, query.sectionId);

  const mayEnter = await canEnterMarks(auth, ctx.section.id, ctx.examSubject.classSubjectId);
  if (!mayEnter && (await checkPermission(auth, "exam:view")) !== "OK") {
    throw new AppError("You do not teach this subject in this section", httpStatus.FORBIDDEN);
  }

  const students = await studentsOfSheet(ctx);
  const marks = await prisma.examMark.findMany({
    where: { examSubjectId: ctx.examSubject.id, enrollmentId: { in: students.map((s) => s.enrollmentId) } },
  });
  const markOf = new Map(marks.map((m) => [m.enrollmentId, m]));

  const blocker = entryBlocker(ctx);
  const items = students.map((s) => {
    const mark = markOf.get(s.enrollmentId);
    return {
      enrollmentId: s.enrollmentId,
      rollNumber: s.rollNumber,
      student: s.student,
      group: s.group,
      entered: mark !== undefined,
      isAbsent: mark?.isAbsent ?? false,
      parts: (mark?.partMarks as Record<string, number> | null) ?? null,
      total: mark?.total ?? null,
      updatedAt: mark?.updatedAt ?? null,
    };
  });

  return {
    exam: ctx.examSubject.examClass.exam,
    class: ctx.examSubject.examClass.class,
    section: ctx.section,
    subject: ctx.examSubject.classSubject.subject,
    date: dayKey(ctx.examSubject.date),
    fullMarks: ctx.examSubject.fullMarks,
    passMarks: ctx.examSubject.passMarks,
    parts: ctx.examSubject.parts,
    canEdit: mayEnter && blocker === null,
    cannotEditReason: !mayEnter ? "You do not teach this subject in this section" : blocker,
    progress: {
      students: items.length,
      entered: items.filter((i) => i.entered).length,
      absent: items.filter((i) => i.isAbsent).length,
    },
    items,
  };
};

/*
 * Saves marks for some or all students of the sheet. Each mark is checked against the
 * subject: every part's marks within its full marks (the total is their sum), or the total
 * within the full marks.
 */
const saveSheet = async (auth: Auth, data: SaveSheetPayload) => {
  const ctx = await loadSheetContext(auth.schoolId!, data.examSubjectId, data.sectionId);

  if (!(await canEnterMarks(auth, ctx.section.id, ctx.examSubject.classSubjectId))) {
    throw new AppError("You do not teach this subject in this section", httpStatus.FORBIDDEN);
  }
  const blocker = entryBlocker(ctx);
  if (blocker) throw new AppError(blocker, httpStatus.CONFLICT);

  const students = await studentsOfSheet(ctx);
  const studentOf = new Map(students.map((s) => [s.enrollmentId, s]));
  if (data.marks.some((m) => !studentOf.has(m.enrollmentId))) {
    throw new AppError("One or more students do not sit this subject in this section", httpStatus.BAD_REQUEST);
  }

  await writeMarks(
    auth.userId,
    data.marks.map((m) => {
      const student = studentOf.get(m.enrollmentId)!;
      return {
        examSubjectId: ctx.examSubject.id,
        enrollmentId: m.enrollmentId,
        studentId: student.student.id,
        ...checkMark(ctx.examSubject, m, student.student.nameEn),
      };
    }),
  );

  return getSheet(auth, { examSubjectId: data.examSubjectId, sectionId: data.sectionId });
};

// ------------------------------------------------ section grid (all subjects)

/*
 * The whole marks grid of a section: every student against every subject they could sit.
 * A cell for a subject the student does not sit (another group, religion or 4th subject)
 * is marked sits: false.
 */
const getGrid = async (schoolId: string, query: GridQuery) => {
  const examClass = await findExamClass(schoolId, query.examId, query.classId);
  const section = await prisma.section.findFirst({
    where: { id: query.sectionId, schoolId, classId: query.classId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!section) throw new AppError("Section not found in this class", httpStatus.NOT_FOUND);

  const { subjects, students } = await loadExamStudents(prisma, examClass.id, { sectionId: section.id });
  // only the subjects somebody in this section sits
  const columns = subjects.filter((s) => students.some((st) => st.examSubjectIds.has(s.id)));

  const marks = await prisma.examMark.findMany({
    where: { examSubjectId: { in: columns.map((c) => c.id) }, enrollmentId: { in: students.map((s) => s.enrollmentId) } },
  });
  const markOf = new Map(marks.map((m) => [`${m.enrollmentId}:${m.examSubjectId}`, m]));

  const blocker = classBlocker(examClass.status);
  return {
    exam: examClass.exam,
    class: examClass.class,
    section,
    status: examClass.status,
    canEdit: blocker === null,
    cannotEditReason: blocker,
    subjects: columns.map(subjectColumn),
    students: students.map((s) => ({
      enrollmentId: s.enrollmentId,
      rollNumber: s.rollNumber,
      student: s.student,
      group: s.group,
      marks: Object.fromEntries(
        columns.map((c) => [
          c.id,
          s.examSubjectIds.has(c.id) ? { sits: true, ...markCell(markOf.get(`${s.enrollmentId}:${c.id}`)) } : { sits: false },
        ]),
      ),
    })),
    progress: {
      cells: students.reduce((n, s) => n + columns.filter((c) => s.examSubjectIds.has(c.id)).length, 0),
      entered: marks.length,
    },
  };
};

/* Saves any cells of a section grid, all or nothing. Admins (exam:enter_marks) only. */
const saveGrid = async (auth: Auth, data: SaveGridPayload) => {
  const schoolId = auth.schoolId!;
  const examClass = await findExamClass(schoolId, data.examId, data.classId);
  const blocker = classBlocker(examClass.status);
  if (blocker) throw new AppError(blocker, httpStatus.CONFLICT);

  const section = await prisma.section.findFirst({
    where: { id: data.sectionId, schoolId, classId: data.classId },
    select: { id: true },
  });
  if (!section) throw new AppError("Section not found in this class", httpStatus.NOT_FOUND);

  const { subjects, students } = await loadExamStudents(prisma, examClass.id, { sectionId: section.id });
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const studentOf = new Map(students.map((s) => [s.enrollmentId, s]));

  const rows = data.marks.map((m) => {
    const subject = subjectOf.get(m.examSubjectId);
    if (!subject) throw new AppError("One or more subjects are not in this class's exam", httpStatus.BAD_REQUEST);
    const student = studentOf.get(m.enrollmentId);
    if (!student) throw new AppError("One or more students are not in this section for the exam", httpStatus.BAD_REQUEST);
    if (!student.examSubjectIds.has(subject.id)) {
      throw new AppError(
        `${student.student.nameEn} does not sit ${subject.classSubject.subject.nameEn}`,
        httpStatus.BAD_REQUEST,
      );
    }
    if (!isOpen(subject.date)) {
      throw new AppError(
        `${subject.classSubject.subject.nameEn}: marks can be entered from the exam day (${dayKey(subject.date)})`,
        httpStatus.CONFLICT,
      );
    }
    return {
      examSubjectId: subject.id,
      enrollmentId: m.enrollmentId,
      studentId: student.student.id,
      ...checkMark(subject, m, student.student.nameEn),
    };
  });

  await writeMarks(auth.userId, rows);
  return getGrid(schoolId, { examId: data.examId, classId: data.classId, sectionId: data.sectionId });
};

// ---------------------------------------------- one student (all subjects)

/* The enrollment of a student in the exam's year, and that class's part of the exam. */
const loadStudentContext = async (schoolId: string, examId: string, enrollmentId: string) => {
  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId }, select: { id: true, academicYearId: true } });
  if (!exam) throw new AppError("Exam not found", httpStatus.NOT_FOUND);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, academicYearId: exam.academicYearId, student: { schoolId } },
    select: { id: true, classId: true, sectionId: true },
  });
  if (!enrollment) throw new AppError("The student is not enrolled in the exam's academic year", httpStatus.NOT_FOUND);

  const examClass = await findExamClass(schoolId, examId, enrollment.classId);
  const { subjects, students } = await loadExamStudents(prisma, examClass.id, { sectionId: enrollment.sectionId });
  const student = students.find((s) => s.enrollmentId === enrollmentId);
  if (!student) throw new AppError("The student does not sit this exam", httpStatus.BAD_REQUEST);

  return { examClass, student, subjects: subjects.filter((s) => student.examSubjectIds.has(s.id)) };
};

/* Every subject one student sits in the exam, with their marks. */
const getStudentMarks = async (schoolId: string, query: StudentQuery) => {
  const { examClass, student, subjects } = await loadStudentContext(schoolId, query.examId, query.enrollmentId);

  const marks = await prisma.examMark.findMany({
    where: { enrollmentId: student.enrollmentId, examSubjectId: { in: subjects.map((s) => s.id) } },
  });
  const markOf = new Map(marks.map((m) => [m.examSubjectId, m]));

  const blocker = classBlocker(examClass.status);
  return {
    exam: examClass.exam,
    class: examClass.class,
    section: student.section,
    student: student.student,
    rollNumber: student.rollNumber,
    group: student.group,
    status: examClass.status,
    canEdit: blocker === null,
    cannotEditReason: blocker,
    subjects: subjects.map((s) => ({ ...subjectColumn(s), ...markCell(markOf.get(s.id)) })),
  };
};

/* Saves some or all of one student's subjects, all or nothing. Admins (exam:enter_marks) only. */
const saveStudentMarks = async (auth: Auth, data: SaveStudentPayload) => {
  const schoolId = auth.schoolId!;
  const { examClass, student, subjects } = await loadStudentContext(schoolId, data.examId, data.enrollmentId);
  const blocker = classBlocker(examClass.status);
  if (blocker) throw new AppError(blocker, httpStatus.CONFLICT);

  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const rows = data.marks.map((m) => {
    const subject = subjectOf.get(m.examSubjectId);
    if (!subject) throw new AppError("One or more subjects are not sat by this student", httpStatus.BAD_REQUEST);
    if (!isOpen(subject.date)) {
      throw new AppError(
        `${subject.classSubject.subject.nameEn}: marks can be entered from the exam day (${dayKey(subject.date)})`,
        httpStatus.CONFLICT,
      );
    }
    return {
      examSubjectId: subject.id,
      enrollmentId: student.enrollmentId,
      studentId: student.student.id,
      ...checkMark(subject, m, student.student.nameEn),
    };
  });

  await writeMarks(auth.userId, rows);
  return getStudentMarks(schoolId, { examId: data.examId, enrollmentId: data.enrollmentId });
};

// ------------------------------------------------------------------- progress

/*
 * How far marks entry has got for a class: each subject in each section, how many students
 * sit it and how many marks are in. Publishing waits until nothing is missing.
 */
export const marksProgress = async (examClassId: string) => {
  const { subjects, students } = await loadExamStudents(prisma, examClassId);
  const marks = await prisma.examMark.findMany({
    where: { examSubject: { examClassId } },
    select: { examSubjectId: true, enrollmentId: true, isAbsent: true },
  });
  const markOf = new Map(marks.map((m) => [`${m.examSubjectId}:${m.enrollmentId}`, m]));

  const sections = [...new Map(students.map((s) => [s.section.id, s.section])).values()];
  let missing = 0;

  const items = subjects.flatMap((subject) =>
    sections.map((section) => {
      const sitting = students.filter((s) => s.section.id === section.id && s.examSubjectIds.has(subject.id));
      const entered = sitting.filter((s) => markOf.has(`${subject.id}:${s.enrollmentId}`));
      const absent = entered.filter((s) => markOf.get(`${subject.id}:${s.enrollmentId}`)!.isAbsent);
      missing += sitting.length - entered.length;
      return {
        examSubjectId: subject.id,
        subject: subject.classSubject.subject,
        date: dayKey(subject.date),
        section,
        students: sitting.length,
        entered: entered.length,
        absent: absent.length,
        complete: entered.length === sitting.length,
      };
    }),
  ).filter((i) => i.students > 0);

  return { missing, complete: missing === 0, items };
};

const getProgress = async (schoolId: string, query: ProgressQuery) => {
  const examClass = await prisma.examClass.findFirst({
    where: { examId: query.examId, classId: query.classId, exam: { schoolId } },
    select: { id: true, status: true, class: { select: { id: true, name: true } }, exam: { select: { id: true, nameEn: true, nameBn: true } } },
  });
  if (!examClass) throw new AppError("This class is not part of the exam", httpStatus.NOT_FOUND);

  return { exam: examClass.exam, class: examClass.class, status: examClass.status, ...(await marksProgress(examClass.id)) };
};

// --------------------------------------------------------- a teacher's sheets

/* The marks sheets the logged-in teacher can fill: their subjects and sections in classes now in marks entry. */
const getMySheets = async (auth: Auth, query: MineQuery) => {
  if (!auth.membershipId) return { items: [] };

  const assignments = await prisma.subjectTeacher.findMany({
    where: {
      schoolId: auth.schoolId!,
      teacher: { membershipId: auth.membershipId, status: { in: WORKING_STATUSES } },
    },
    select: { sectionId: true, classSubjectId: true, section: { select: { id: true, name: true, isDefault: true } } },
  });
  if (assignments.length === 0) return { items: [] };

  const examSubjects = await prisma.examSubject.findMany({
    where: {
      classSubjectId: { in: assignments.map((a) => a.classSubjectId) },
      examClass: { status: "MARKS_ENTRY", ...(query.examId ? { examId: query.examId } : {}) },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      classSubjectId: true,
      classSubject: { select: { subject: { select: { id: true, nameEn: true, nameBn: true, code: true } } } },
      examClass: {
        select: { class: { select: { id: true, name: true } }, exam: { select: { id: true, nameEn: true, nameBn: true } } },
      },
    },
  });

  const today = todayInBangladesh().getTime();
  return {
    items: examSubjects.flatMap((es) =>
      assignments
        .filter((a) => a.classSubjectId === es.classSubjectId)
        .map((a) => ({
          examSubjectId: es.id,
          exam: es.examClass.exam,
          class: es.examClass.class,
          section: a.section,
          subject: es.classSubject.subject,
          date: dayKey(es.date),
          open: es.date.getTime() <= today,
        })),
    ),
  };
};

export const ExamMarksService = {
  getSheet,
  saveSheet,
  getGrid,
  saveGrid,
  getStudentMarks,
  saveStudentMarks,
  getProgress,
  getMySheets,
};
