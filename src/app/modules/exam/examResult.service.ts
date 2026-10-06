import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import type { AttendanceStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { dayKey } from "../../shared/scheduleSchemas";
import {
  computeStudentResult,
  type MarkInput,
  rankResults,
  type ResultRules,
  round2,
  type ScaleRules,
  type SubjectInput,
} from "./examResult.calc";
import type { ExamClassPayload, MarksheetQuery, SummaryQuery, TabulationQuery } from "./examResult.validation";
import { marksProgress } from "./examMarks.service";
import { loadExamStudents } from "./examStudents";

type Auth = NonNullable<Express.Request["auth"]>;

export const scaleInclude = {
  markBands: { orderBy: { minPercent: "desc" } },
  gpaBands: { orderBy: { minGpa: "desc" } },
} satisfies Prisma.GradingScaleInclude;

type ScaleWithBands = Prisma.GradingScaleGetPayload<{ include: typeof scaleInclude }>;

export const toScaleRules = (s: ScaleWithBands): ScaleRules => ({
  id: s.id,
  name: s.name,
  maxGpa: Number(s.maxGpa),
  failGrade: s.failGrade,
  failIfAnyCompulsoryFails: s.failIfAnyCompulsoryFails,
  optionalBonusEnabled: s.optionalBonusEnabled,
  optionalBonusThreshold: Number(s.optionalBonusThreshold),
  markBands: s.markBands.map((b) => ({ minPercent: Number(b.minPercent), grade: b.grade, point: Number(b.point) })),
  gpaBands: s.gpaBands.map((b) => ({ minGpa: Number(b.minGpa), grade: b.grade })),
});

// ------------------------------------------------------------------- helpers

const findExamClass = async (schoolId: string, examId: string, classId: string) => {
  const examClass = await prisma.examClass.findFirst({
    where: { examId, classId, exam: { schoolId } },
    include: {
      class: { select: { id: true, name: true, numericLevel: true } },
      exam: {
        select: {
          id: true,
          nameEn: true,
          nameBn: true,
          type: true,
          attendanceFrom: true,
          attendanceTo: true,
          academicYear: { select: { id: true, name: true, startDate: true } },
        },
      },
    },
  });
  if (!examClass) throw new AppError("This class is not part of the exam", httpStatus.NOT_FOUND);
  return examClass;
};

/*
 * Students who could choose an optional (4th) subject but have not: their result would
 * be missing a subject, so publishing waits for them.
 */
const missingOptionalChoices = async (
  schoolId: string,
  academicYearId: string,
  classId: string,
  students: Awaited<ReturnType<typeof loadExamStudents>>["students"],
) => {
  const options = await prisma.classSubject.findMany({
    where: { schoolId, academicYearId, classId, type: "OPTIONAL" },
    select: { groupId: true },
  });
  if (options.length === 0) return [];
  return students.filter(
    (s) => s.optionalClassSubjectId === null && options.some((o) => o.groupId === null || o.groupId === s.group?.id),
  );
};

/* Present (incl. late), absent and leave days of each enrollment over a period. */
export const attendanceOver = async (enrollmentIds: string[], from: Date, to: Date) => {
  const rows = await prisma.studentAttendance.groupBy({
    by: ["enrollmentId", "status"],
    where: { enrollmentId: { in: enrollmentIds }, session: { date: { gte: from, lte: to } } },
    _count: { _all: true },
  });
  const byEnrollment = new Map<string, Record<AttendanceStatus, number>>();
  for (const r of rows) {
    const counts = byEnrollment.get(r.enrollmentId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    counts[r.status] = r._count._all;
    byEnrollment.set(r.enrollmentId, counts);
  }
  return (enrollmentId: string) => {
    const c = byEnrollment.get(enrollmentId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    return {
      attendanceDays: c.PRESENT + c.ABSENT + c.LATE + c.LEAVE,
      attendancePresent: c.PRESENT + c.LATE,
      attendanceAbsent: c.ABSENT,
      attendanceLeave: c.LEAVE,
    };
  };
};

export const attendancePercent = (r: { attendanceDays: number; attendancePresent: number }) =>
  r.attendanceDays === 0 ? null : round2((r.attendancePresent / r.attendanceDays) * 100);

// -------------------------------------------------------------------- publish

/*
 * Publishes a class's result: checks every mark is in and every 4th subject chosen, works
 * out each student's result with the class's rules, ranks them in the section and class,
 * adds attendance, and saves it all. The grading scales used become locked, and marks
 * cannot change until the result is unlocked.
 */
const publishResult = async (auth: Auth, data: ExamClassPayload) => {
  const schoolId = auth.schoolId!;
  const examClass = await findExamClass(schoolId, data.examId, data.classId);
  if (examClass.status === "PUBLISHED") throw new AppError("The result is already published", httpStatus.CONFLICT);
  if (examClass.status === "ROUTINE") throw new AppError("Marks entry has not been opened yet", httpStatus.CONFLICT);

  const progress = await marksProgress(examClass.id);
  if (!progress.complete) {
    throw new AppError(`${progress.missing} mark(s) are still missing`, httpStatus.CONFLICT, {
      incomplete: progress.items.filter((i) => !i.complete),
    });
  }

  const { subjects, students } = await loadExamStudents(prisma, examClass.id);
  if (students.length === 0) throw new AppError("No student sits this exam", httpStatus.BAD_REQUEST);

  const academicYearId = examClass.exam.academicYear.id;
  const noChoice = await missingOptionalChoices(schoolId, academicYearId, examClass.classId, students);
  if (noChoice.length > 0) {
    throw new AppError(`${noChoice.length} student(s) have not chosen their optional (4th) subject`, httpStatus.CONFLICT, {
      students: noChoice.map((s) => ({ enrollmentId: s.enrollmentId, student: s.student, section: s.section })),
    });
  }

  // ------------------------------------------------------------------ the rules
  const setting = await prisma.classResultSetting.findUnique({
    where: { academicYearId_classId: { academicYearId, classId: examClass.classId } },
    include: { gradingScale: { include: scaleInclude } },
  });
  if (!setting) throw new AppError("Set the class's result settings first", httpStatus.BAD_REQUEST);
  if (setting.resultSystem === "GRADED" && !setting.gradingScale) {
    throw new AppError("A graded result needs a grading scale in the class's result settings", httpStatus.BAD_REQUEST);
  }

  const subjectScaleIds = [
    ...new Set(subjects.flatMap((s) => (s.classSubject.gradingScaleId ? [s.classSubject.gradingScaleId] : []))),
  ];
  const subjectScales = new Map(
    (await prisma.gradingScale.findMany({ where: { id: { in: subjectScaleIds } }, include: scaleInclude })).map((s) => [
      s.id,
      toScaleRules(s),
    ]),
  );
  const classScale = setting.gradingScale ? toScaleRules(setting.gradingScale) : null;
  const graded = setting.resultSystem === "GRADED";

  const rules: ResultRules = {
    resultSystem: setting.resultSystem,
    combinePapers: setting.combinePapers,
    absentRule: setting.absentRule,
    scale: classScale,
  };

  const subjectInputs = new Map<string, SubjectInput>(
    subjects.map((s) => [
      s.id,
      {
        examSubjectId: s.id,
        subject: s.classSubject.subject,
        isOptional: s.classSubject.type === "OPTIONAL",
        sortOrder: s.classSubject.sortOrder,
        fullMarks: Number(s.fullMarks),
        passMarks: Number(s.passMarks),
        parts: s.parts.map((p) => ({ name: p.name, fullMarks: Number(p.fullMarks), passMarks: Number(p.passMarks) })),
        scale: graded ? ((s.classSubject.gradingScaleId && subjectScales.get(s.classSubject.gradingScaleId)) || classScale) : null,
      },
    ]),
  );

  // ------------------------------------------------------------ calculate
  const marks = await prisma.examMark.findMany({ where: { examSubject: { examClassId: examClass.id } } });
  const marksOf = new Map<string, Map<string, MarkInput>>();
  for (const m of marks) {
    const map = marksOf.get(m.enrollmentId) ?? new Map<string, MarkInput>();
    map.set(m.examSubjectId, {
      isAbsent: m.isAbsent,
      total: m.total === null ? null : Number(m.total),
      partMarks: (m.partMarks as Record<string, number> | null) ?? null,
    });
    marksOf.set(m.enrollmentId, map);
  }

  const lastDay = new Date(Math.max(...subjects.map((s) => s.date.getTime())));
  const attendanceFrom = examClass.exam.attendanceFrom ?? examClass.exam.academicYear.startDate;
  const attendanceTo = examClass.exam.attendanceTo ?? lastDay;
  const attendanceOf = await attendanceOver(students.map((s) => s.enrollmentId), attendanceFrom, attendanceTo);

  const results = students.map((s) => {
    const own = [...s.examSubjectIds].map((id) => subjectInputs.get(id)!);
    const result = computeStudentResult(rules, own, marksOf.get(s.enrollmentId) ?? new Map());
    return { ...s, result, passed: result.passed, gpa: result.gpa, totalMarks: result.totalMarks };
  });

  const classPositions = rankResults(results);
  const sectionPositions = new Map<(typeof results)[number], number>();
  for (const sectionId of new Set(results.map((r) => r.section.id))) {
    for (const [r, p] of rankResults(results.filter((r) => r.section.id === sectionId))) sectionPositions.set(r, p);
  }

  // the rules as they were, printed as the grading reference on result sheets
  const usedScales = [classScale, ...subjectScales.values()].filter((s): s is ScaleRules => s !== null);
  const resultRules = {
    resultSystem: setting.resultSystem,
    combinePapers: setting.combinePapers,
    absentRule: setting.absentRule,
    classScale,
    subjectScales: [...subjectScales.values()],
    attendancePeriod: { from: dayKey(attendanceFrom), to: dayKey(attendanceTo) },
  };

  // ----------------------------------------------------------------- save
  await prisma.$transaction(
    async (tx) => {
      await tx.examResult.deleteMany({ where: { examClassId: examClass.id } });

      for (const r of results) {
        await tx.examResult.create({
          data: {
            examClassId: examClass.id,
            enrollmentId: r.enrollmentId,
            studentId: r.student.id,
            sectionId: r.section.id,
            totalMarks: r.result.totalMarks,
            fullMarks: r.result.fullMarks,
            percentage: r.result.percentage,
            gpa: r.result.gpa,
            grade: r.result.grade,
            passed: r.result.passed,
            failedSubjects: r.result.failedSubjects,
            sectionPosition: sectionPositions.get(r)!,
            classPosition: classPositions.get(r)!,
            ...attendanceOf(r.enrollmentId),
            subjects: {
              create: r.result.subjects.map((l) => ({
                subjectId: l.id,
                nameEn: l.nameEn,
                nameBn: l.nameBn,
                code: l.code,
                isOptional: l.isOptional,
                isAbsent: l.isAbsent,
                excluded: l.excluded,
                fullMarks: l.fullMarks,
                passMarks: l.passMarks,
                marks: l.marks,
                percentage: l.percentage,
                passed: l.passed,
                grade: l.grade,
                point: l.point,
                parts: l.parts ?? Prisma.DbNull,
                papers: l.papers ?? Prisma.DbNull,
                sortOrder: l.sortOrder,
              })),
            },
          },
        });
      }

      await tx.examClass.update({
        where: { id: examClass.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: auth.userId,
          resultRules: resultRules as unknown as Prisma.InputJsonValue,
        },
      });

      // a scale used by a published result never changes again (edit a copy instead)
      if (usedScales.length > 0) {
        await tx.gradingScale.updateMany({ where: { id: { in: usedScales.map((s) => s.id) } }, data: { isLocked: true } });
      }
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const passed = results.filter((r) => r.result.passed).length;
  return {
    exam: { id: examClass.exam.id, nameEn: examClass.exam.nameEn, nameBn: examClass.exam.nameBn },
    class: examClass.class,
    published: results.length,
    passed,
    failed: results.length - passed,
    passRate: round2((passed / results.length) * 100),
  };
};

/* Takes a published result back: results are removed and marks can be changed again. */
const unlockResult = async (schoolId: string, data: ExamClassPayload) => {
  const examClass = await findExamClass(schoolId, data.examId, data.classId);
  if (examClass.status !== "PUBLISHED") throw new AppError("The result is not published", httpStatus.CONFLICT);

  // a published final result is built on this exam's result
  const finalResult = await prisma.finalResultFormula.findFirst({
    where: {
      schoolId,
      classId: data.classId,
      status: "PUBLISHED",
      components: { some: { exams: { some: { examId: data.examId } } } },
    },
    select: { nameEn: true },
  });
  if (finalResult) {
    throw new AppError(
      `The final result "${finalResult.nameEn}" uses this exam. Unlock that final result first`,
      httpStatus.CONFLICT,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.examResult.deleteMany({ where: { examClassId: examClass.id } });
    await tx.examClass.update({
      where: { id: examClass.id },
      data: { status: "MARKS_ENTRY", publishedAt: null, publishedBy: null, resultRules: Prisma.DbNull },
    });
  });
  return { exam: examClass.exam.nameEn, class: examClass.class, status: "MARKS_ENTRY" as const };
};

// -------------------------------------------------------------------- reports

const resultInclude = {
  subjects: { orderBy: { sortOrder: "asc" } },
  student: { select: { id: true, nameEn: true, nameBn: true, admissionNo: true, photo: true, fatherName: true, motherName: true } },
  enrollment: {
    select: {
      rollNumber: true,
      section: { select: { id: true, name: true, isDefault: true } },
      group: { select: { id: true, nameEn: true, nameBn: true } },
    },
  },
} satisfies Prisma.ExamResultInclude;

const assertPublished = (examClass: { status: string }) => {
  if (examClass.status !== "PUBLISHED") throw new AppError("The result has not been published yet", httpStatus.CONFLICT);
};

/* Pass rate, grade counts and the top marks of a set of results. */
export const summarize = (results: { passed: boolean; grade: string | null; totalMarks: Prisma.Decimal; gpa: Prisma.Decimal | null }[]) => {
  const passed = results.filter((r) => r.passed).length;
  const grades: Record<string, number> = {};
  for (const r of results) if (r.grade) grades[r.grade] = (grades[r.grade] ?? 0) + 1;
  return {
    appeared: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? round2((passed / results.length) * 100) : 0,
    grades,
    highestTotal: results.length ? Math.max(...results.map((r) => Number(r.totalMarks))) : null,
    highestGpa: results.some((r) => r.gpa !== null) ? Math.max(...results.map((r) => Number(r.gpa ?? 0))) : null,
  };
};

/*
 * The tabulation sheet: every student of the class (or one section) against every subject
 * line, with totals, GPA, grade and positions; plus the summary and the grading reference.
 */
const getTabulation = async (schoolId: string, query: TabulationQuery) => {
  const examClass = await findExamClass(schoolId, query.examId, query.classId);
  assertPublished(examClass);

  const results = await prisma.examResult.findMany({
    where: { examClassId: examClass.id, ...(query.sectionId ? { sectionId: query.sectionId } : {}) },
    include: resultInclude,
  });

  const byRoll = (a: (typeof results)[number], b: (typeof results)[number]) =>
    a.enrollment.section.name.localeCompare(b.enrollment.section.name) ||
    (a.enrollment.rollNumber ?? "").localeCompare(b.enrollment.rollNumber ?? "", undefined, { numeric: true });
  results.sort(query.sort === "merit" ? (a, b) => a.classPosition - b.classPosition || byRoll(a, b) : byRoll);

  // the subject columns, in the class's order
  const columns = new Map<string, { subjectId: string; nameEn: string; nameBn: string; code: string | null; isOptional: boolean; sortOrder: number }>();
  for (const r of results) {
    for (const s of r.subjects) {
      if (!columns.has(s.subjectId)) {
        columns.set(s.subjectId, { subjectId: s.subjectId, nameEn: s.nameEn, nameBn: s.nameBn, code: s.code, isOptional: s.isOptional, sortOrder: s.sortOrder });
      }
    }
  }

  return {
    exam: { id: examClass.exam.id, nameEn: examClass.exam.nameEn, nameBn: examClass.exam.nameBn },
    academicYear: { id: examClass.exam.academicYear.id, name: examClass.exam.academicYear.name },
    class: examClass.class,
    publishedAt: examClass.publishedAt,
    rules: examClass.resultRules,
    subjects: [...columns.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    summary: summarize(results),
    students: results.map((r) => ({
      enrollmentId: r.enrollmentId,
      student: r.student,
      rollNumber: r.enrollment.rollNumber,
      section: r.enrollment.section,
      group: r.enrollment.group,
      totalMarks: r.totalMarks,
      fullMarks: r.fullMarks,
      percentage: r.percentage,
      gpa: r.gpa,
      grade: r.grade,
      passed: r.passed,
      failedSubjects: r.failedSubjects,
      sectionPosition: r.sectionPosition,
      classPosition: r.classPosition,
      attendancePercent: attendancePercent(r),
      subjects: Object.fromEntries(r.subjects.map((s) => [s.subjectId, s])),
    })),
  };
};

/*
 * One student's mark sheet: the school, exam and student, every subject line (with parts
 * and combined papers), totals, GPA, grade, positions (out of how many), attendance and
 * the grading reference.
 */
const getMarksheet = async (schoolId: string, query: MarksheetQuery) => {
  const result = await prisma.examResult.findFirst({
    where: { enrollmentId: query.enrollmentId, examClass: { examId: query.examId, exam: { schoolId } } },
    include: {
      ...resultInclude,
      examClass: { select: { classId: true, publishedAt: true, resultRules: true } },
    },
  });
  if (!result) throw new AppError("No published result for this student in this exam", httpStatus.NOT_FOUND);

  const examClass = await findExamClass(schoolId, query.examId, result.examClass.classId);
  const [school, classCount, sectionCount] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { nameEn: true, nameBn: true, logo: true, address: true, phone: true, email: true, website: true, language: true },
    }),
    prisma.examResult.count({ where: { examClassId: result.examClassId } }),
    prisma.examResult.count({ where: { examClassId: result.examClassId, sectionId: result.sectionId } }),
  ]);

  const { examClass: _, subjects, ...rest } = result;
  return {
    school,
    exam: { id: examClass.exam.id, nameEn: examClass.exam.nameEn, nameBn: examClass.exam.nameBn },
    academicYear: { id: examClass.exam.academicYear.id, name: examClass.exam.academicYear.name },
    class: examClass.class,
    publishedAt: result.examClass.publishedAt,
    ...rest,
    position: {
      section: result.sectionPosition,
      sectionOutOf: sectionCount,
      class: result.classPosition,
      classOutOf: classCount,
    },
    attendance: {
      period: (result.examClass.resultRules as { attendancePeriod?: unknown } | null)?.attendancePeriod ?? null,
      workingDays: result.attendanceDays,
      present: result.attendancePresent,
      absent: result.attendanceAbsent,
      leave: result.attendanceLeave,
      percentage: attendancePercent(result),
    },
    subjects,
    // the grading tables used for this result (absent for a marks-only result)
    gradingReference: result.examClass.resultRules,
  };
};

/* Every class of an exam: whether published, and its result summary. */
const getExamSummary = async (schoolId: string, query: SummaryQuery) => {
  const exam = await prisma.exam.findFirst({
    where: { id: query.examId, schoolId },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      classes: {
        orderBy: { class: { numericLevel: "asc" } },
        select: { id: true, status: true, publishedAt: true, class: { select: { id: true, name: true, numericLevel: true } } },
      },
    },
  });
  if (!exam) throw new AppError("Exam not found", httpStatus.NOT_FOUND);

  const results = await prisma.examResult.findMany({
    where: { examClass: { examId: exam.id } },
    select: { examClassId: true, passed: true, grade: true, totalMarks: true, gpa: true },
  });

  return {
    exam: { id: exam.id, nameEn: exam.nameEn, nameBn: exam.nameBn },
    classes: exam.classes.map((c) => ({
      class: c.class,
      status: c.status,
      publishedAt: c.publishedAt,
      summary: c.status === "PUBLISHED" ? summarize(results.filter((r) => r.examClassId === c.id)) : null,
    })),
  };
};

export const ExamResultService = {
  publishResult,
  unlockResult,
  getTabulation,
  getMarksheet,
  getExamSummary,
};
