import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../errorHandler/AppError";

const authorize = (permissionCode: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new AppError("You are not authenticated", httpStatus.UNAUTHORIZED);
      }

      const { userId, sessionType, schoolId, membershipId, isPlatformAdmin } = req.auth;

      // the platform owner may use every route of every school
      if (isPlatformAdmin && sessionType === "SCHOOL" && schoolId) {
        return next();
      }

      if (sessionType !== "SCHOOL" || !schoolId || !membershipId) {
        throw new AppError("Invalid school authorization context", httpStatus.FORBIDDEN);
      }

      const [moduleEnabled, hasPermission] = await Promise.all([
        // the permission's module must be enabled for this school (paid modules!),
        // and this applies to the school super admin too
        prisma.schoolModule.findFirst({
          where: {
            schoolId,
            isEnabled: true,
            module: {
              isActive: true,
              permissions: { some: { code: permissionCode, isActive: true } },
            },
          },
          select: { id: true },
        }),
        prisma.userRole.findFirst({
          where: {
            userId,
            membershipId,
            role: {
              scope: "SCHOOL",
              schoolId,
              OR: [
                { name: "SCHOOL_SUPER_ADMIN", isSystem: true },
                {
                  permissions: {
                    some: { permission: { code: permissionCode, isActive: true } },
                  },
                },
              ],
            },
          },
          select: { id: true },
        }),
      ]);

      if (!moduleEnabled) {
        throw new AppError("This feature is not enabled for your school", httpStatus.FORBIDDEN);
      }
      if (!hasPermission) {
        throw new AppError("You do not have permission to perform this action", httpStatus.FORBIDDEN);
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
};

export default authorize;