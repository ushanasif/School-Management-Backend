import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../errorHandler/AppError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const verifyOrigin = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next(); // not a browser (scripts, server-to-server)

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return next(new AppError("Invalid origin!", httpStatus.FORBIDDEN));
  }

  // Express 5 + "trust proxy": host comes from X-Forwarded-Host when present
  if (originHost !== req.host.toLowerCase()) {
    return next(new AppError("Cross-site request blocked!", httpStatus.FORBIDDEN));
  }
  return next();
};

export default verifyOrigin;