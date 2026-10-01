import type { CookieOptions, Response } from "express";
import { authConfig } from "../config/auth.config";

export type SessionType = "PLATFORM" | "SCHOOL";

export const cookieNames = {
  PLATFORM: { access: "platformAccessToken", refresh: "platformRefreshToken", flag: "platformSession" },
  SCHOOL: { access: "schoolAccessToken", refresh: "schoolRefreshToken", flag: "schoolSession" },
} as const;

const secure = authConfig.isProd;

// No `domain`: cookies stay host-only, so each school subdomain has its own.
const accessOptions: CookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/" };

// Only sent to the auth endpoints, never attached to ordinary API calls.
const refreshOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: "strict",
  path: authConfig.refreshCookiePath,
};

// Not a secret and readable by JS: lets Next.js middleware know a session exists.
const flagOptions: CookieOptions = { httpOnly: false, secure, sameSite: "lax", path: "/" };

export const setAuthCookies = (
  res: Response,
  type: SessionType,
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
) => {
  const names = cookieNames[type];
  const refreshMaxAge = Math.max(tokens.refreshExpiresAt.getTime() - Date.now(), 0);

  res.cookie(names.access, tokens.accessToken, { ...accessOptions, maxAge: authConfig.accessTtlMs });
  res.cookie(names.refresh, tokens.refreshToken, { ...refreshOptions, maxAge: refreshMaxAge });
  res.cookie(names.flag, "1", { ...flagOptions, maxAge: refreshMaxAge });
};

export const clearAuthCookies = (res: Response, type: SessionType) => {
  const names = cookieNames[type];

  res.clearCookie(names.access, accessOptions);
  res.clearCookie(names.refresh, refreshOptions);
  res.clearCookie(names.flag, flagOptions);
};