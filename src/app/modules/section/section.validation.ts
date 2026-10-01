// validations/section.validation.ts
import { z } from "zod";

const createSectionSchema = z.object({
  body: z.object({
    classId: z.string(),
    name: z.string().min(1).max(50),
  }),
});

export const updateSectionSchema = z.object({
  params: z.object({ sectionId: z.string() }),
  body: z.object({
    name: z.string().min(1).max(50),
  }),
});

export const listSectionsQuerySchema = z.object({
  query: z.object({
    classId: z.string().optional(),
  }),
});

export const setSectionYearConfigSchema = z.object({
  params: z.object({ sectionId: z.string() }),
  body: z.object({
    academicYearId: z.string(),
    classTeacherMembershipId: z.string().optional(),
    capacity: z.number().int().positive().optional(),
  }),
});

export const getSectionYearConfigQuerySchema = z.object({
  params: z.object({ sectionId: z.string() }),
  query: z.object({
    academicYearId: z.string(),
  }),
});

export const SectionValidation = {createSectionSchema}