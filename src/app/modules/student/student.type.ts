import type { z } from "zod";
import { StudentValidation } from "./student.validation";

export type CreateStudentPayload = z.infer<typeof StudentValidation.createStudent>;
export type UpdateStudentPayload = z.infer<typeof StudentValidation.updateStudent>;
export type ListStudentsQuery = z.infer<typeof StudentValidation.listStudentsQuery>;