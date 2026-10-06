import type { z } from "zod";
import { SubjectValidation } from "./subject.validation";

export type CreateSubjectPayload = z.infer<typeof SubjectValidation.createSubject>;
export type UpdateSubjectPayload = z.infer<typeof SubjectValidation.updateSubject>;
export type ListSubjectsQuery = z.infer<typeof SubjectValidation.listSubjectsQuery>;
