/*
 * Result calculation, with no database access: given the rules, a student's subjects and
 * marks, it works out every subject line, the totals, the GPA, the grade and pass / fail.
 * Kept pure so it can be checked on its own.
 */

export type ScaleRules = {
  id: string;
  name: string;
  maxGpa: number;
  failGrade: string;
  failIfAnyCompulsoryFails: boolean;
  optionalBonusEnabled: boolean;
  optionalBonusThreshold: number;
  markBands: { minPercent: number; grade: string; point: number }[]; // highest first
  gpaBands: { minGpa: number; grade: string }[]; // highest first
};

export type ResultRules = {
  resultSystem: "GRADED" | "MARKS_ONLY";
  combinePapers: boolean;
  absentRule: "FAIL" | "EXCLUDE";
  // the class's scale (GRADED); its GPA rules decide the overall result
  scale: ScaleRules | null;
};

type SubjectInfo = { id: string; nameEn: string; nameBn: string; code: string | null };

export type SubjectInput = {
  examSubjectId: string;
  subject: SubjectInfo & { parent: SubjectInfo | null };
  isOptional: boolean;
  sortOrder: number;
  fullMarks: number;
  passMarks: number;
  parts: { name: string; fullMarks: number; passMarks: number }[];
  // the subject's own scale, else the class's
  scale: ScaleRules | null;
};

export type MarkInput = { isAbsent: boolean; total: number | null; partMarks: Record<string, number> | null };

export type PartLine = { name: string; fullMarks: number; passMarks: number; marks: number | null; passed: boolean };
export type PaperLine = SubjectInfo & { fullMarks: number; marks: number | null; isAbsent: boolean };

export type SubjectLine = SubjectInfo & {
  isOptional: boolean;
  isAbsent: boolean;
  excluded: boolean;
  fullMarks: number;
  passMarks: number;
  marks: number | null;
  percentage: number;
  passed: boolean;
  grade: string | null;
  point: number | null;
  parts: PartLine[] | null;
  papers: PaperLine[] | null;
  sortOrder: number;
};

export type StudentResult = {
  subjects: SubjectLine[];
  totalMarks: number;
  fullMarks: number;
  percentage: number;
  gpa: number | null;
  grade: string | null;
  passed: boolean;
  failedSubjects: number;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const percentOf = (marks: number, full: number) => (full > 0 ? round2((marks / full) * 100) : 0);

/* The band whose start is the highest one not above the value (bands are sorted highest first). */
const markBand = (scale: ScaleRules, percentage: number) =>
  scale.markBands.find((b) => percentage >= b.minPercent) ?? scale.markBands[scale.markBands.length - 1];
const gpaGrade = (scale: ScaleRules, gpa: number) =>
  (scale.gpaBands.find((b) => gpa >= b.minGpa) ?? scale.gpaBands[scale.gpaBands.length - 1]).grade;

/*
 * One line to grade: a subject, or (papers combined) a parent subject made of its papers.
 * Combined: full / pass marks and same-named parts are added up. If any paper is absent,
 * the whole combined subject counts as absent.
 */
type GradingUnit = {
  info: SubjectInfo;
  isOptional: boolean;
  sortOrder: number;
  fullMarks: number;
  passMarks: number;
  parts: { name: string; fullMarks: number; passMarks: number; marks: number | null }[];
  marks: number | null;
  isAbsent: boolean;
  scale: ScaleRules | null;
  papers: PaperLine[] | null;
};

const buildUnits = (rules: ResultRules, subjects: SubjectInput[], marks: Map<string, MarkInput>): GradingUnit[] => {
  const single = (s: SubjectInput): GradingUnit => {
    const m = marks.get(s.examSubjectId);
    const isAbsent = !m || m.isAbsent;
    return {
      info: { id: s.subject.id, nameEn: s.subject.nameEn, nameBn: s.subject.nameBn, code: s.subject.code },
      isOptional: s.isOptional,
      sortOrder: s.sortOrder,
      fullMarks: s.fullMarks,
      passMarks: s.passMarks,
      parts: s.parts.map((p) => ({ ...p, marks: isAbsent ? null : (m!.partMarks?.[p.name] ?? 0) })),
      marks: isAbsent ? null : (m!.total ?? 0),
      isAbsent,
      scale: s.scale,
      papers: null,
    };
  };

  if (!rules.combinePapers) return subjects.map(single);

  const units: GradingUnit[] = [];
  const byParent = new Map<string, SubjectInput[]>();
  for (const s of subjects) {
    if (s.subject.parent) byParent.set(s.subject.parent.id, [...(byParent.get(s.subject.parent.id) ?? []), s]);
    else units.push(single(s));
  }

  for (const papers of byParent.values()) {
    const lines = papers.map(single);
    const parent = papers[0].subject.parent!;
    const isAbsent = lines.some((l) => l.isAbsent);

    const parts = new Map<string, GradingUnit["parts"][number]>();
    for (const l of lines) {
      for (const p of l.parts) {
        const sum = parts.get(p.name) ?? { name: p.name, fullMarks: 0, passMarks: 0, marks: 0 };
        sum.fullMarks += p.fullMarks;
        sum.passMarks += p.passMarks;
        sum.marks = isAbsent ? null : (sum.marks ?? 0) + (p.marks ?? 0);
        parts.set(p.name, sum);
      }
    }

    units.push({
      info: parent,
      isOptional: lines.some((l) => l.isOptional),
      sortOrder: Math.min(...lines.map((l) => l.sortOrder)),
      fullMarks: round2(lines.reduce((s, l) => s + l.fullMarks, 0)),
      passMarks: round2(lines.reduce((s, l) => s + l.passMarks, 0)),
      parts: [...parts.values()],
      marks: isAbsent ? null : round2(lines.reduce((s, l) => s + (l.marks ?? 0), 0)),
      isAbsent,
      scale: lines[0].scale,
      papers: lines.map((l) => ({ ...l.info, fullMarks: l.fullMarks, marks: l.marks, isAbsent: l.isAbsent })),
    });
  }

  return units.sort((a, b) => a.sortOrder - b.sortOrder);
};

const gradeUnit = (rules: ResultRules, u: GradingUnit): SubjectLine => {
  const excluded = u.isAbsent && rules.absentRule === "EXCLUDE";
  const marks = u.isAbsent ? 0 : u.marks!;

  const parts = u.parts.length > 0
    ? u.parts.map((p) => ({ ...p, passed: !u.isAbsent && (p.marks ?? 0) >= p.passMarks }))
    : null;
  const passed = !u.isAbsent && marks >= u.passMarks && (parts ?? []).every((p) => p.passed);
  const percentage = percentOf(marks, u.fullMarks);

  let grade: string | null = null;
  let point: number | null = null;
  if (rules.resultSystem === "GRADED" && u.scale && !excluded) {
    ({ grade, point } = gradeOf(u.scale, percentage, passed));
  }

  return {
    ...u.info,
    isOptional: u.isOptional,
    isAbsent: u.isAbsent,
    excluded,
    fullMarks: u.fullMarks,
    passMarks: u.passMarks,
    marks: u.isAbsent ? null : marks,
    percentage,
    // an excluded subject neither passes nor fails
    passed: excluded ? true : passed,
    grade,
    point,
    parts,
    papers: u.papers,
    sortOrder: u.sortOrder,
  };
};

/* A subject's grade and point from its percentage (a failed subject: the fail grade, 0 points). */
export const gradeOf = (scale: ScaleRules, percentage: number, passed: boolean) => {
  if (!passed) return { grade: scale.failGrade, point: 0 };
  const band = markBand(scale, percentage);
  return { grade: band.grade, point: band.point };
};

type GradedLine = { excluded: boolean; isOptional: boolean; passed: boolean; point: number | null; marks: number | null; fullMarks: number };

/*
 * The overall result from graded subject lines: totals, GPA (compulsory points averaged,
 * plus the 4th subject bonus, capped at the maximum), the overall grade and pass / fail.
 * Used by exam results and by final results alike.
 */
export const overallResult = (rules: ResultRules, lines: GradedLine[]) => {
  const counted = lines.filter((l) => !l.excluded);

  const totalMarks = round2(counted.reduce((s, l) => s + (l.marks ?? 0), 0));
  const fullMarks = round2(counted.reduce((s, l) => s + l.fullMarks, 0));
  const compulsory = counted.filter((l) => !l.isOptional);
  // failing the optional (4th) subject never fails the student
  const failedSubjects = compulsory.filter((l) => !l.passed).length;
  const base = { totalMarks, fullMarks, percentage: percentOf(totalMarks, fullMarks), failedSubjects };

  if (rules.resultSystem === "MARKS_ONLY" || !rules.scale) {
    return { ...base, gpa: null, grade: null, passed: compulsory.length > 0 && failedSubjects === 0 };
  }

  const scale = rules.scale;
  let gpa = 0;
  if (compulsory.length > 0 && !(scale.failIfAnyCompulsoryFails && failedSubjects > 0)) {
    const points = compulsory.reduce((s, l) => s + (l.point ?? 0), 0);
    const optional = counted.find((l) => l.isOptional);
    const bonus =
      scale.optionalBonusEnabled && optional?.point != null
        ? Math.max(0, optional.point - scale.optionalBonusThreshold)
        : 0;
    gpa = Math.min(scale.maxGpa, round2((points + bonus) / compulsory.length));
  }

  const grade = gpaGrade(scale, gpa);
  return { ...base, gpa, grade, passed: compulsory.length > 0 && grade !== scale.failGrade };
};

/* A student's whole result: every subject line, totals, GPA, grade and pass / fail. */
export const computeStudentResult = (
  rules: ResultRules,
  subjects: SubjectInput[],
  marks: Map<string, MarkInput>,
): StudentResult => {
  const lines = buildUnits(rules, subjects, marks).map((u) => gradeUnit(rules, u));
  return { subjects: lines, ...overallResult(rules, lines) };
};

/*
 * Merit positions: passed students first, then higher GPA (graded results), then higher
 * total marks. Equal students share a position and the next one skips (1, 2, 2, 4).
 */
export const rankResults = <T extends { passed: boolean; gpa: number | null; totalMarks: number }>(results: T[]) => {
  const better = (a: T, b: T) =>
    Number(b.passed) - Number(a.passed) || (b.gpa ?? 0) - (a.gpa ?? 0) || b.totalMarks - a.totalMarks;

  const sorted = [...results].sort(better);
  const positions = new Map<T, number>();
  sorted.forEach((r, i) => {
    const previous = sorted[i - 1];
    positions.set(r, i > 0 && better(previous, r) === 0 ? positions.get(previous)! : i + 1);
  });
  return positions;
};
