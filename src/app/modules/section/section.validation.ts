import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";
import { timeSchema as time } from "../../shared/scheduleSchemas";

// validateRequest({ body }) parses req.body directly, so these schemas are the bodies themselves

const sectionName = z
  .string({ error: "Section name is required!" })
  .trim()
  .min(1, "Section name is required!")
  .max(50, "Section name cannot exceed 50 characters");

const optionalId = z.string().trim().min(1).optional();

const createSectionSchema = z.object({
  classId: idSchema("Class"),
  name: sectionName,
});

// the class of a section never changes: enrollments store both, so only a rename is allowed
const updateSectionSchema = z.strictObject({
  name: sectionName,
});

const sectionIdParams = z.object({ sectionId: idSchema("Section id") });

const listSectionsQuery = z.object({
  classId: optionalId,
  // teacher, capacity, class hours and student counts are for this year; defaults to the current year
  academicYearId: optionalId,
});

const sectionQuery = z.object({
  academicYearId: optionalId,
});

const yearConfigQuery = z.object({
  academicYearId: idSchema("Academic year"),
});

// missing = leave as it is, null = clear
const setYearConfigSchema = z
  .strictObject({
    academicYearId: idSchema("Academic year"),
    classTeacherMembershipId: z.string().trim().min(1).nullable().optional(),
    // optional and only a warning: it never blocks an admission
    capacity: z.number().int("Capacity must be a whole number").positive("Capacity must be greater than zero").max(500).nullable().optional(),
    // the section's normal class hours; both are set together (checked after merging with what is saved)
    startTime: time.nullable().optional(),
    endTime: time.nullable().optional(),
  })
  .refine(
    (d) =>
      d.classTeacherMembershipId !== undefined ||
      d.capacity !== undefined ||
      d.startTime !== undefined ||
      d.endTime !== undefined,
    { message: "Provide a class teacher, a capacity or class hours" },
  );

export const SectionValidation = {
  createSectionSchema,
  updateSectionSchema,
  sectionIdParams,
  listSectionsQuery,
  sectionQuery,
  yearConfigQuery,
  setYearConfigSchema,
};
