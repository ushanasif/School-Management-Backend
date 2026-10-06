import type { z } from "zod";
import { ClassSubjectValidation } from "./classSubject.validation";

export type AssignSubjectsPayload = z.infer<typeof ClassSubjectValidation.assignSubjects>;
export type ListClassSubjectsQuery = z.infer<typeof ClassSubjectValidation.listQuery>;
export type UpdateClassSubjectPayload = z.infer<typeof ClassSubjectValidation.updateClassSubject>;
export type SetMarksPayload = z.infer<typeof ClassSubjectValidation.setMarks>;
