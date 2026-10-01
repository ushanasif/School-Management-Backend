import { z } from "zod";
import { withFilters } from "../../utils/querySchema";
import { SchoolStatus } from "../../../../generated/prisma/enums";
import { caseInsensitiveEnum } from "../../utils/caseInsensitiveEnum";
import { emailSchema } from "../../utils/identity";

const schoolStatusValues = Object.values(SchoolStatus) as [string, ...string[]];

const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "app", "mail", "static", "cdn", "dashboard", "support", "help", "docs", "status",
]);

export const createSchoolSchema = z.object({
    nameEn: z.string().min(2).max(200),
    nameBn: z.string().min(2).max(200).optional(), 
    subdomain: z
      .string()
      .min(2)
      .max(63)
      .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase letters, numbers, hyphens only")
      .refine((v) => !RESERVED_SUBDOMAINS.has(v), "This subdomain is reserved"),
    email: emailSchema,
    phone: z.string().min(10).max(15).optional(),
    website: z.string().url().optional(),
    address: z.string().optional(),
    language: z.enum(["EN", "BN"]).optional(),
    monthlyFee: z.number().nonnegative().optional(),
    discount: z.number().min(0).max(100).optional(),
});


const activateSchoolSchema = z.object({
    schoolId: z.string().min(1, "School id is required!")
})

const createSchoolSuperAdminSchema = z.object({
  fullname: z.string().min(2).max(120),
  email: emailSchema,
})

const getAllSchoolsQuerySchema = withFilters({
  status: caseInsensitiveEnum(schoolStatusValues).optional()
});



export const SchoolValidation = {
  createSchoolSchema,
  activateSchoolSchema,
  createSchoolSuperAdminSchema,
  getAllSchoolsQuerySchema
};
