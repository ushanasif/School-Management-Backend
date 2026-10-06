import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";

const examClass = z.strictObject({
  examId: idSchema("Exam"),
  classId: idSchema("Class"),
});

const tabulationQuery = z.object({
  examId: idSchema("Exam"),
  classId: idSchema("Class"),
  sectionId: z.string().trim().min(1).optional(),
  // roll = register order; merit = by class position
  sort: z.enum(["roll", "merit"]).default("roll"),
});

const marksheetQuery = z.object({
  examId: idSchema("Exam"),
  enrollmentId: idSchema("Student enrollment"),
});

const summaryQuery = z.object({
  examId: idSchema("Exam"),
});

export const ExamResultValidation = { examClass, tabulationQuery, marksheetQuery, summaryQuery };

export type ExamClassPayload = z.infer<typeof examClass>;
export type TabulationQuery = z.infer<typeof tabulationQuery>;
export type MarksheetQuery = z.infer<typeof marksheetQuery>;
export type SummaryQuery = z.infer<typeof summaryQuery>;
