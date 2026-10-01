import type { z } from "zod";
import type { AuthValidation } from "./auth.validation";

export type PlatformLoginPayload = z.infer<typeof AuthValidation.platformLoginSchema>;
export type SchoolLoginPayload = z.infer<typeof AuthValidation.schoolLoginSchema>;
export type ChangePasswordPayload = z.infer<typeof AuthValidation.changePasswordSchema>;

export type PlatformJwtPayload = {
  userId: string;
  sessionType: "PLATFORM";
  tokenType: "ACCESS";
};

export type SchoolJwtPayload = {
  userId: string;
  sessionType: "SCHOOL";
  schoolId: string;
  tokenType: "ACCESS";
};

export type JwtPayload = PlatformJwtPayload | SchoolJwtPayload;

// what verifyToken returns: the payload plus the issued-at second
export type VerifiedJwtPayload = JwtPayload & { iat: number };