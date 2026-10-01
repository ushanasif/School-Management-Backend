import jwt from "jsonwebtoken";
import type { JwtPayload as LibJwtPayload, SignOptions } from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../errorHandler/AppError";
import type { JwtPayload, VerifiedJwtPayload } from "../modules/auth/auth.type";

const generateToken = (
  payload: JwtPayload,
  secret: string,
  expiresIn: SignOptions["expiresIn"],
) => {
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" });
};

const unauthorized = (message: string) => new AppError(message, httpStatus.UNAUTHORIZED);

// Every failure is an AppError 401, so the client always gets a clean "go refresh".
const verifyToken = (token: string, secret: string): VerifiedJwtPayload => {
  let decoded: string | LibJwtPayload;

  try {
    decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (error) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      throw unauthorized("Access token expired!");
    }
    throw unauthorized("Invalid access token!");
  }

  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    typeof decoded.iat !== "number" ||
    decoded.tokenType !== "ACCESS"
  ) {
    throw unauthorized("Invalid access token!");
  }

  if (decoded.sessionType === "PLATFORM") {
    return { userId: decoded.userId, sessionType: "PLATFORM", tokenType: "ACCESS", iat: decoded.iat };
  }

  if (decoded.sessionType === "SCHOOL" && typeof decoded.schoolId === "string") {
    return {
      userId: decoded.userId,
      sessionType: "SCHOOL",
      schoolId: decoded.schoolId,
      tokenType: "ACCESS",
      iat: decoded.iat,
    };
  }

  throw unauthorized("Invalid access token!");
};

export const JwtUtils = { generateToken, verifyToken };