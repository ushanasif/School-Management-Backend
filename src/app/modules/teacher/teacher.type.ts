import type { z } from "zod";
import { TeacherValidation } from "./teacher.validation";

export type CreateTeacherPayload = z.infer<typeof TeacherValidation.createTeacher>;
export type UpdateTeacherPayload = z.infer<typeof TeacherValidation.updateTeacher>;
export type DeactivateTeacherPayload = z.infer<typeof TeacherValidation.deactivateTeacher>;
export type ListTeachersQuery = z.infer<typeof TeacherValidation.listTeachersQuery>;
export type YearQuery = z.infer<typeof TeacherValidation.yearQuery>;
export type ScheduleQuery = z.infer<typeof TeacherValidation.scheduleQuery>;
