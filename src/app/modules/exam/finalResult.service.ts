import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { dayKey } from "../../shared/scheduleSchemas";
import { rankResults, type ResultRules, round2, type ScaleRules } from "./examResult.calc";
import { attendanceOver, attendancePercent, scaleInclude, summarize, toScaleRules } from "./examResult.service";
import { computeFinalResult, type ExamLine, type FinalComponent, type FinalSubjectInput } from "./finalResult.calc";
import type {
  CreateFormulaPayload,
  FinalListQuery,
  FinalMarksheetQuery,
  FinalTabulationQuery,
  UpdateFormulaPayload,
} from "./finalResult.validation";

type Auth = NonNullable<Express.Request["auth"]>;

const formulaInclude = {
  academicYear: { select: { id: true, name: true } },
  class: { select: { id: true, name: true, numericLevel: true } },
  components: {
    orderBy: { sortOrder: "asc" },
    include: { exams: { select: { exam: { select: { id: true, nameEn: true, nameBn: true, type: true } } } } },
  },
} satisfies Prisma.FinalResultFormulaInclude;

// ------------------------------------------------------------------- helpers

const resolveYear = async (schoolId: string, academicYearId?: string) => {
  const year = academicYearId
    ? await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } })
    : await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  if (!year) {
    throw academicYearId
      ? new AppError("Academic year not found for this school", httpStatus.NOT_FOUND)
      : new AppError("No current academic year is set. Choose an academic year", httpStatus.BAD_REQUEST);
  }
  return year;
};

const findFormula = async (schoolId: string, formulaId: string) => {
  const formula = await prisma.finalResultFormula.findFirst({ where: { id: formulaId, schoolId }, include: formulaInclude });
  if (!formula) throw new AppError("Final result formula not found", httpStatus.NOT_FOUND);
  return formula;
};

/* Every exam must be of the school and year, and include the class. */
const assertExams = async (schoolId: string, academicYearId: string, classId: string, examIds: string[]) => {
  const exams = await prisma.exam.findMany({
    where: { id: { in: examIds }, schoolId, academicYearId },
    select: { id: true, nameEn: true, classes: { where: { classId }, select: { id: true } } },
  });
  if (exams.length !== examIds.length) {
    throw new AppError("One or more exams were not found in this academic year", httpStatus.NOT_FOUND);
  }
  const without = exams.find((e) => e.classes.length === 0);
  if (without) throw new AppError(`${without.nameEn} does not include this class`, httpStatus.BAD_REQUEST);
};

const assertAttendancePeriod = (year: { startDate: Date; endDate: Date }, from?: Date, to?: Date) => {
  const inYear = (d: Date) => dayKey(d) >= dayKey(year.startDate) && dayKey(d) <= dayKey(year.endDate);
  if (from && to && (!inYear(from) || !inYear(to))) {
    throw new AppError("The attendance period must be inside the academic year", httpStatus.BAD_REQUEST);
  }
};

const componentsCreate = (data: UpdateFormulaPayload) => ({
  create: data.components.map((c, i) => ({
    nameEn: c.nameEn,
    nameBn: c.nameBn,
    weight: c.weight,
    method: c.method,
    bestCount: c.bestCount ?? null,
    sortOrder: i,
    exams: { create: c.examIds.map((examId) => ({ examId })) },
  })),
});

const assertNameFree = async (academicYearId: string, classId: string, nameEn: string, excludeId?: string) => {
  const clash = await prisma.finalResultFormula.findFirst({
    where: {
      academicYearId,
      classId,
      nameEn: { equals: nameEn, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AppError("This class already has a final result with this name", httpStatus.CONFLICT);
};

// ------------------------------------------------------------------- formulas

const createFormula = async (schoolId: string, userId: string, data: CreateFormulaPayload) => {
  const year = await resolveYear(schoolId, data.academicYearId);
  const schoolClass = await prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId }, select: { id: true } });
  if (!schoolClass) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);

  await assertExams(schoolId, year.id, data.classId, data.components.flatMap((c) => c.examIds));
  assertAttendancePeriod(year, data.attendanceFrom, data.attendanceTo);
  await assertNameFree(year.id, data.classId, data.nameEn);

  return prisma.finalResultFormula.create({
    data: {
      schoolId,
      academicYearId: year.id,
      classId: data.classId,
      nameEn: data.nameEn,
      nameBn: data.nameBn,
      attendanceFrom: data.attendanceFrom ?? null,
      attendanceTo: data.attendanceTo ?? null,
      createdBy: userId,
      components: componentsCreate(data),
    },
    include: formulaInclude,
  });
};

const getFormulas = async (schoolId: string, query: FinalListQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);
  const items = await prisma.finalResultFormula.findMany({
    where: { schoolId, academicYearId: year.id, ...(query.classId ? { classId: query.classId } : {}) },
    orderBy: [{ class: { numericLevel: "asc" } }, { createdAt: "asc" }],
    include: formulaInclude,
  });
  return { academicYear: { id: year.id, name: year.name }, items };
};

/* The formula, and for each of its exams whether this class's result is published yet. */
const getFormulaById = async (schoolId: string, formulaId: string) => {
  const formula = await findFormula(schoolId, formulaId);
  const examIds = formula.components.flatMap((c) => c.exams.map((e) => e.exam.id));
  const examClasses = await prisma.examClass.findMany({
    where: { examId: { in: examIds }, classId: formula.classId },
    select: { examId: true, status: true },
  });
  const statusOf = new Map(examClasses.map((ec) => [ec.examId, ec.status]));

  return {
    ...formula,
    ready: examIds.every((id) => statusOf.get(id) === "PUBLISHED"),
    exams: examIds.map((id) => ({ examId: id, status: statusOf.get(id) ?? null })),
  };
};

/* Replaces the name, attendance period and components. Only while not published. */
const updateFormula = async (schoolId: string, formulaId: string, data: UpdateFormulaPayload) => {
  const formula = await findFormula(schoolId, formulaId);
  if (formula.status === "PUBLISHED") {
    throw new AppError("This final result is published. Unlock it first to change the formula", httpStatus.CONFLICT);
  }
  const year = await resolveYear(schoolId, formula.academicYearId);
  await assertExams(schoolId, year.id, formula.classId, data.components.flatMap((c) => c.examIds));
  assertAttendancePeriod(year, data.attendanceFrom, data.attendanceTo);
  if (data.nameEn !== formula.nameEn) await assertNameFree(year.id, formula.classId, data.nameEn, formulaId);

  return prisma.$transaction(async (tx) => {
    await tx.finalResultComponent.deleteMany({ where: { formulaId } });
    return tx.finalResultFormula.update({
      where: { id: formulaId },
      data: {
        nameEn: data.nameEn,
        nameBn: data.nameBn,
        attendanceFrom: data.attendanceFrom ?? null,
        attendanceTo: data.attendanceTo ?? null,
        components: componentsCreate(data),
      },
      include: formulaInclude,
    });
  });
};

const deleteFormula = async (schoolId: string, formulaId: string) => {
  const formula = await findFormula(schoolId, formulaId);
  if (formula.status === "PUBLISHED") {
    throw new AppError("This final result is published. Unlock it first to delete it", httpStatus.CONFLICT);
  }
  await prisma.finalResultFormula.delete({ where: { id: formulaId } });
};

// -------------------------------------------------------------------- publish

/*
 * Works out and saves the final result of the class: every exam in the formula must have
 * its result published for the class. The class's current result settings and scales are
 * used (and the scales become locked), as for an exam result.
 */
const publishFinal = async (auth: Auth, formulaId: string) => {
  const schoolId = auth.schoolId!;
  const formula = await findFormula(schoolId, formulaId);
  if (formula.status === "PUBLISHED") throw new AppError("This final result is already published", httpStatus.CONFLICT);

  const examIds = formula.components.flatMap((c) => c.exams.map((e) => e.exam.id));
  const examClasses = await prisma.examClass.findMany({
    where: { examId: { in: examIds }, classId: formula.classId },
    select: { id: true, examId: true, status: true, exam: { select: { nameEn: true } } },
  });
  const notPublished = examClasses.filter((ec) => ec.status !== "PUBLISHED");
  if (notPublished.length > 0 || examClasses.length !== examIds.length) {
    throw new AppError(
      `Publish these exam results for the class first: ${notPublished.map((ec) => ec.exam.nameEn).join(", ")}`,
      httpStatus.CONFLICT,
    );
  }

  // ------------------------------------------------------------------ the rules
  const setting = await prisma.classResultSetting.findUnique({
    where: { academicYearId_classId: { academicYearId: formula.academicYearId, classId: formula.classId } },
    include: { gradingScale: { include: scaleInclude } },
  });
  if (!setting) throw new AppError("Set the class's result settings first", httpStatus.BAD_REQUEST);
  if (setting.resultSystem === "GRADED" && !setting.gradingScale) {
    throw new AppError("A graded result needs a grading scale in the class's result settings", httpStatus.BAD_REQUEST);
  }
  const classScale = setting.gradingScale ? toScaleRules(setting.gradingScale) : null;
  const graded = setting.resultSystem === "GRADED";
  const rules: ResultRules = {
    resultSystem: setting.resultSystem,
    combinePapers: setting.combinePapers,
    absentRule: setting.absentRule,
    scale: classScale,
  };

  // a subject's own scale (a combined subject takes its papers' scale)
  const classSubjects = await prisma.classSubject.findMany({
    where: { academicYearId: formula.academicYearId, classId: formula.classId, gradingScaleId: { not: null } },
    select: { gradingScaleId: true, subject: { select: { id: true, parentId: true } } },
  });
  const scaleIds = [...new Set(classSubjects.map((cs) => cs.gradingScaleId!))];
  const scales = new Map(
    (await prisma.gradingScale.findMany({ where: { id: { in: scaleIds } }, include: scaleInclude })).map((s) => [s.id, toScaleRules(s)]),
  );
  const subjectScale = new Map<string, ScaleRules>();
  for (const cs of classSubjects) {
    const scale = scales.get(cs.gradingScaleId!)!;
    subjectScale.set(cs.subject.id, scale);
    if (cs.subject.parentId && !subjectScale.has(cs.subject.parentId)) subjectScale.set(cs.subject.parentId, scale);
  }

  // --------------------------------------------------------- the exam results
  const examIdOf = new Map(examClasses.map((ec) => [ec.id, ec.examId]));
  const examResults = await prisma.examResult.findMany({
    where: { examClassId: { in: examClasses.map((ec) => ec.id) } },
    select: {
      examClassId: true,
      enrollmentId: true,
      studentId: true,
      subjects: {
        select: { subjectId: true, nameEn: true, nameBn: true, code: true, isOptional: true, excluded: true, fullMarks: true, passMarks: true, percentage: true, sortOrder: true },
      },
    },
  });
  if (examResults.length === 0) throw new AppError("These exams have no results for the class", httpStatus.BAD_REQUEST);

  // each student's subjects, with their line in every exam
  const byStudent = new Map<string, { studentId: string; subjects: Map<string, FinalSubjectInput> }>();
  for (const r of examResults) {
    const entry = byStudent.get(r.enrollmentId) ?? { studentId: r.studentId, subjects: new Map() };
    for (const s of r.subjects) {
      const input = entry.subjects.get(s.subjectId) ?? {
        subject: { id: s.subjectId, nameEn: s.nameEn, nameBn: s.nameBn, code: s.code },
        isOptional: s.isOptional,
        sortOrder: s.sortOrder,
        scale: graded ? (subjectScale.get(s.subjectId) ?? classScale) : null,
        perExam: new Map<string, ExamLine>(),
      };
      const full = Number(s.fullMarks);
      input.perExam.set(examIdOf.get(r.examClassId)!, {
        percentage: Number(s.percentage),
        passPercentage: full > 0 ? (Number(s.passMarks) / full) * 100 : 0,
        fullMarks: full,
        excluded: s.excluded,
      });
      entry.subjects.set(s.subjectId, input);
    }
    byStudent.set(r.enrollmentId, entry);
  }

  const components: FinalComponent[] = formula.components.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameBn: c.nameBn,
    weight: Number(c.weight),
    method: c.method,
    bestCount: c.bestCount,
    examIds: c.exams.map((e) => e.exam.id),
  }));

  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: [...byStudent.keys()] } },
    select: { id: true, sectionId: true },
  });
  const sectionOf = new Map(enrollments.map((e) => [e.id, e.sectionId]));

  const results = [...byStudent.entries()].map(([enrollmentId, s]) => {
    const result = computeFinalResult(rules, components, [...s.subjects.values()]);
    return {
      enrollmentId,
      studentId: s.studentId,
      sectionId: sectionOf.get(enrollmentId)!,
      result,
      passed: result.passed,
      gpa: result.gpa,
      totalMarks: result.totalMarks,
    };
  });

  const classPositions = rankResults(results);
  const sectionPositions = new Map<(typeof results)[number], number>();
  for (const sectionId of new Set(results.map((r) => r.sectionId))) {
    for (const [r, p] of rankResults(results.filter((r) => r.sectionId === sectionId))) sectionPositions.set(r, p);
  }

  // attendance: the formula's period, or year start to the last exam day
  const year = await resolveYear(schoolId, formula.academicYearId);
  const lastExamDay = await prisma.examSubject.aggregate({
    where: { examClassId: { in: examClasses.map((ec) => ec.id) } },
    _max: { date: true },
  });
  const attendanceFrom = formula.attendanceFrom ?? year.startDate;
  const attendanceTo = formula.attendanceTo ?? lastExamDay._max.date ?? year.endDate;
  const attendanceOf = await attendanceOver(results.map((r) => r.enrollmentId), attendanceFrom, attendanceTo);

  const usedScales = [classScale, ...scales.values()].filter((s): s is ScaleRules => s !== null);
  const resultRules = {
    resultSystem: setting.resultSystem,
    combinePapers: setting.combinePapers,
    absentRule: setting.absentRule,
    classScale,
    subjectScales: [...scales.values()],
    components: components.map((c) => ({
      ...c,
      exams: c.examIds.map((id) => formula.components.flatMap((fc) => fc.exams).find((e) => e.exam.id === id)!.exam),
    })),
    attendancePeriod: { from: dayKey(attendanceFrom), to: dayKey(attendanceTo) },
  };

  // ----------------------------------------------------------------- save
  await prisma.$transaction(
    async (tx) => {
      await tx.finalResult.deleteMany({ where: { formulaId } });

      for (const r of results) {
        await tx.finalResult.create({
          data: {
            formulaId,
            enrollmentId: r.enrollmentId,
            studentId: r.studentId,
            sectionId: r.sectionId,
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
                excluded: l.excluded,
                percentage: l.percentage,
                passPercentage: l.passPercentage,
                fullMarks: l.fullMarks,
                marks: l.marks,
                passed: l.passed,
                grade: l.grade,
                point: l.point,
                components: l.components as unknown as Prisma.InputJsonValue,
                sortOrder: l.sortOrder,
              })),
            },
          },
        });
      }

      await tx.finalResultFormula.update({
        where: { id: formulaId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: auth.userId,
          resultRules: resultRules as unknown as Prisma.InputJsonValue,
        },
      });

      if (usedScales.length > 0) {
        await tx.gradingScale.updateMany({ where: { id: { in: usedScales.map((s) => s.id) } }, data: { isLocked: true } });
      }
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const passed = results.filter((r) => r.result.passed).length;
  return {
    formula: { id: formula.id, nameEn: formula.nameEn, nameBn: formula.nameBn },
    class: formula.class,
    published: results.length,
    passed,
    failed: results.length - passed,
    passRate: round2((passed / results.length) * 100),
  };
};

/* Takes the final result back; publishing again recalculates it. */
const unlockFinal = async (schoolId: string, formulaId: string) => {
  const formula = await findFormula(schoolId, formulaId);
  if (formula.status !== "PUBLISHED") throw new AppError("This final result is not published", httpStatus.CONFLICT);

  await prisma.$transaction(async (tx) => {
    await tx.finalResult.deleteMany({ where: { formulaId } });
    await tx.finalResultFormula.update({
      where: { id: formulaId },
      data: { status: "DRAFT", publishedAt: null, publishedBy: null, resultRules: Prisma.DbNull },
    });
  });
  return { formula: { id: formula.id, nameEn: formula.nameEn }, status: "DRAFT" as const };
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
} satisfies Prisma.FinalResultInclude;

const assertPublished = (formula: { status: string }) => {
  if (formula.status !== "PUBLISHED") throw new AppError("This final result has not been published yet", httpStatus.CONFLICT);
};

/* The final tabulation sheet: students against subjects, with each subject's component percentages. */
const getTabulation = async (schoolId: string, formulaId: string, query: FinalTabulationQuery) => {
  const formula = await findFormula(schoolId, formulaId);
  assertPublished(formula);

  const results = await prisma.finalResult.findMany({
    where: { formulaId, ...(query.sectionId ? { sectionId: query.sectionId } : {}) },
    include: resultInclude,
  });
  const byRoll = (a: (typeof results)[number], b: (typeof results)[number]) =>
    a.enrollment.section.name.localeCompare(b.enrollment.section.name) ||
    (a.enrollment.rollNumber ?? "").localeCompare(b.enrollment.rollNumber ?? "", undefined, { numeric: true });
  results.sort(query.sort === "merit" ? (a, b) => a.classPosition - b.classPosition || byRoll(a, b) : byRoll);

  const columns = new Map<string, { subjectId: string; nameEn: string; nameBn: string; code: string | null; isOptional: boolean; sortOrder: number }>();
  for (const r of results) {
    for (const s of r.subjects) {
      if (!columns.has(s.subjectId)) {
        columns.set(s.subjectId, { subjectId: s.subjectId, nameEn: s.nameEn, nameBn: s.nameBn, code: s.code, isOptional: s.isOptional, sortOrder: s.sortOrder });
      }
    }
  }

  return {
    formula: { id: formula.id, nameEn: formula.nameEn, nameBn: formula.nameBn },
    academicYear: formula.academicYear,
    class: formula.class,
    publishedAt: formula.publishedAt,
    rules: formula.resultRules,
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

/* One student's final mark sheet, with how each subject was made up and the grading reference. */
const getMarksheet = async (schoolId: string, formulaId: string, query: FinalMarksheetQuery) => {
  const formula = await findFormula(schoolId, formulaId);
  assertPublished(formula);

  const result = await prisma.finalResult.findUnique({
    where: { formulaId_enrollmentId: { formulaId, enrollmentId: query.enrollmentId } },
    include: resultInclude,
  });
  if (!result) throw new AppError("No final result for this student", httpStatus.NOT_FOUND);

  const [school, classCount, sectionCount] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { nameEn: true, nameBn: true, logo: true, address: true, phone: true, email: true, website: true, language: true },
    }),
    prisma.finalResult.count({ where: { formulaId } }),
    prisma.finalResult.count({ where: { formulaId, sectionId: result.sectionId } }),
  ]);

  const { subjects, ...rest } = result;
  return {
    school,
    formula: { id: formula.id, nameEn: formula.nameEn, nameBn: formula.nameBn },
    academicYear: formula.academicYear,
    class: formula.class,
    publishedAt: formula.publishedAt,
    ...rest,
    position: { section: result.sectionPosition, sectionOutOf: sectionCount, class: result.classPosition, classOutOf: classCount },
    attendance: {
      period: (formula.resultRules as { attendancePeriod?: unknown } | null)?.attendancePeriod ?? null,
      workingDays: result.attendanceDays,
      present: result.attendancePresent,
      absent: result.attendanceAbsent,
      leave: result.attendanceLeave,
      percentage: attendancePercent(result),
    },
    subjects,
    // the formula's components and the grading tables used
    gradingReference: formula.resultRules,
  };
};

export const FinalResultService = {
  createFormula,
  getFormulas,
  getFormulaById,
  updateFormula,
  deleteFormula,
  publishFinal,
  unlockFinal,
  getTabulation,
  getMarksheet,
};
