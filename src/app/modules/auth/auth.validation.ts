import { z } from "zod";
import { emailSchema, loginIdentifierSchema } from "../../utils/identity";

const platformLoginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(200),
});

const schoolLoginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(200),
});

// 72 is bcrypt's limit: characters past it are silently ignored
const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Current password is required" }).min(1).max(200),
  newPassword: z
    .string({ error: "New password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export const AuthValidation = { platformLoginSchema, schoolLoginSchema, changePasswordSchema };