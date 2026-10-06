import { gradeOf, overallResult, type ResultRules, round2, type ScaleRules } from "./examResult.calc";

/*
 * Final result across exams, with no database access. A formula has weighted components;
 * each component is one or more exams, combined by AVERAGE or by BEST n.
 *
 * For each subject: each component's percentage comes from the student's published exam
 * results that include the subject, and the components are weighted together. Only the
 * components that include the subject count, their weights rescaled among them (a subject
 * only in the annual exam counts 100% annual). The pass percentage is combined the same
 * way; the grade comes from the final percentage. Absent under the EXCLUDE rule counts as
 * missing; absent under FAIL counts as 0%.
 */

export type FinalComponent = {
  id: string;
  nameEn: string;
  nameBn: string;
  weight: number; // all components add up to 100
  method: "AVERAGE" | "BEST";
  bestCount: number | null; // BEST: how many of the best exams count
  examIds: string[];
};

/* One subject line of a published exam result. */
export type ExamLine = { percentage: number; passPercentage: number; fullMarks: number; excluded: boolean };

export type FinalSubjectInput = {
  subject: { id: string; nameEn: string; nameBn: string; code: string | null };
  isOptional: boolean;
  sortOrder: number;
  scale: ScaleRules | null;
  // by exam id: the subject's line in that exam's result
  perExam: Map<string, ExamLine>;
};

export type ComponentLine = {
  componentId: string;
  nameEn: string;
  nameBn: string;
  weight: number;
  percentage: number | null; // null = no exam of this component includes the subject
  exams: { examId: string; percentage: number; used: boolean }[];
};

export type FinalSubjectLine = FinalSubjectInput["subject"] & {
  isOptional: boolean;
  excluded: boolean; // in none of the components
  percentage: number;
  passPercentage: number;
  fullMarks: number; // the largest full marks among the exams, for showing marks
  marks: number | null;
  passed: boolean;
  grade: string | null;
  point: number | null;
  components: ComponentLine[];
  sortOrder: number;
};

const average = (ns: number[]) => ns.reduce((s, n) => s + n, 0) / ns.length;

const componentLine = (c: FinalComponent, perExam: Map<string, ExamLine>) => {
  const available = c.examIds.flatMap((examId) => {
    const line = perExam.get(examId);
    return line && !line.excluded ? [{ examId, ...line }] : [];
  });
  if (available.length === 0) {
    return { line: { componentId: c.id, nameEn: c.nameEn, nameBn: c.nameBn, weight: c.weight, percentage: null, exams: [] }, passPercentage: null, fullMarks: 0 };
  }

  const chosen =
    c.method === "BEST"
      ? [...available].sort((a, b) => b.percentage - a.percentage).slice(0, c.bestCount ?? 1)
      : available;
  const used = new Set(chosen.map((e) => e.examId));

  return {
    line: {
      componentId: c.id,
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      weight: c.weight,
      percentage: round2(average(chosen.map((e) => e.percentage))),
      exams: available.map((e) => ({ examId: e.examId, percentage: e.percentage, used: used.has(e.examId) })),
    },
    passPercentage: average(chosen.map((e) => e.passPercentage)),
    fullMarks: Math.max(...available.map((e) => e.fullMarks)),
  };
};

const finalSubjectLine = (rules: ResultRules, components: FinalComponent[], input: FinalSubjectInput): FinalSubjectLine => {
  const parts = components.map((c) => componentLine(c, input.perExam));
  const counted = parts.filter((p) => p.line.percentage !== null);
  const weightSum = counted.reduce((s, p) => s + p.line.weight, 0);

  const excluded = counted.length === 0;
  const percentage = excluded ? 0 : round2(counted.reduce((s, p) => s + p.line.weight * p.line.percentage!, 0) / weightSum);
  const passPercentage = excluded ? 0 : round2(counted.reduce((s, p) => s + p.line.weight * p.passPercentage!, 0) / weightSum);
  const fullMarks = excluded ? 0 : Math.max(...counted.map((p) => p.fullMarks));
  const passed = !excluded && percentage >= passPercentage;

  let grade: string | null = null;
  let point: number | null = null;
  if (rules.resultSystem === "GRADED" && input.scale && !excluded) ({ grade, point } = gradeOf(input.scale, percentage, passed));

  return {
    ...input.subject,
    isOptional: input.isOptional,
    excluded,
    percentage,
    passPercentage,
    fullMarks,
    marks: excluded ? null : round2((percentage * fullMarks) / 100),
    // a subject in none of the components neither passes nor fails
    passed: excluded ? true : passed,
    grade,
    point,
    components: parts.map((p) => p.line),
    sortOrder: input.sortOrder,
  };
};

/* A student's final result: every subject line, then totals, GPA, grade and pass / fail. */
export const computeFinalResult = (rules: ResultRules, components: FinalComponent[], subjects: FinalSubjectInput[]) => {
  const lines = subjects.map((s) => finalSubjectLine(rules, components, s)).sort((a, b) => a.sortOrder - b.sortOrder);
  return { subjects: lines, ...overallResult(rules, lines) };
};
