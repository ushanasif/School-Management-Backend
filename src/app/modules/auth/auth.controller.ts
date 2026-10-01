import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { AppError } from "../../errorHandler/AppError";
import { DomainUtils } from "../../utils/domain";
import {
  clearAuthCookies,
  cookieNames,
  setAuthCookies,
  type SessionType,
} from "../../utils/cookieOptions";
import { AuthService } from "./auth.service";
import { RefreshRetryError, type ClientMeta } from "./refreshToken.service";

type SessionResult = { accessToken: string; refreshToken: string; refreshExpiresAt: Date };

const getClientMeta = (req: Request): ClientMeta => ({
  userAgent: req.get("user-agent")?.slice(0, 255),
  ipAddress: req.ip,
});

// the school always comes from the host the request arrived on, never from the body
const getSchoolSubdomain = (req: Request) => {
  const subdomain = DomainUtils.getSchoolSubdomain(req.hostname);
  if (!subdomain) throw new AppError("Invalid school domain!", httpStatus.BAD_REQUEST);
  return subdomain;
};

/*
 * Shared by both refresh endpoints. A failed refresh clears the cookies so the
 * client can't loop. The exception is RefreshRetryError (another tab just
 * refreshed): the cookies in the browser are now the winner's, so clearing
 * them would log that tab out.
 */
const refreshHandler = <T extends SessionResult>(
  type: SessionType,
  run: (rawToken: string, req: Request) => Promise<T>,
  pick: (result: T) => unknown,
) =>
  catchAsync(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[cookieNames[type].refresh] as string | undefined;

    if (!rawToken) {
      clearAuthCookies(res, type);
      throw new AppError("Refresh token is required!", httpStatus.UNAUTHORIZED);
    }

    let result: T;
    try {
      result = await run(rawToken, req);
    } catch (error) {
      if (!(error instanceof RefreshRetryError)) clearAuthCookies(res, type);
      throw error;
    }

    setAuthCookies(res, type, result);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Token refreshed successfully!",
      data: pick(result),
    });
  });


// Platform Login
const platformLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.platformLogin(req.body, getClientMeta(req));
  setAuthCookies(res, "PLATFORM", result);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login successful!",
    data: { user: result.user },
  });
});

const schoolLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.schoolLogin(
    { ...req.body, subdomain: getSchoolSubdomain(req) },
    getClientMeta(req),
  );
  setAuthCookies(res, "SCHOOL", result);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login successful!",
    data: { user: result.user, school: result.school, roles: result.roles },
  });
});

const refreshPlatformAccessToken = refreshHandler(
  "PLATFORM",
  (rawToken, req) => AuthService.refreshPlatformAccessToken(rawToken, getClientMeta(req)),
  (result) => ({ user: result.user }),
);

const refreshSchoolAccessToken = refreshHandler(
  "SCHOOL",
  (rawToken, req) =>
    AuthService.refreshSchoolAccessToken(rawToken, getSchoolSubdomain(req), getClientMeta(req)),
  (result) => ({ user: result.user, school: result.school }),
);

const logoutHandler = (type: SessionType) =>
  catchAsync(async (req: Request, res: Response) => {
    await AuthService.logout(req.cookies?.[cookieNames[type].refresh]);
    clearAuthCookies(res, type);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Logout successful!",
      data: null,
    });
  });

const platformLogout = logoutHandler("PLATFORM");
const schoolLogout = logoutHandler("SCHOOL");

const logoutAllSessions = catchAsync(async (req: Request, res: Response) => {
  await AuthService.logoutAllSessions(req.auth!.userId);

  clearAuthCookies(res, "PLATFORM");
  clearAuthCookies(res, "SCHOOL");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out from all sessions!",
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.getMe(req.auth!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully!",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.changePassword(req.auth!, req.body, getClientMeta(req));
  setAuthCookies(res, req.auth!.sessionType, result);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully!",
    data: null,
  });
});

export const AuthController = {
  platformLogin,
  refreshPlatformAccessToken,
  platformLogout,
  schoolLogin,
  refreshSchoolAccessToken,
  schoolLogout,
  logoutAllSessions,
  getMe,
  changePassword,
};