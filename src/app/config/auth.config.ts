import config from "./index";

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "15m", "12h", "7d", "30d". A bare number means days. */
const parseDuration = (name: string, value: string | undefined, fallback: string): number => {
  const raw = (value ?? fallback).trim();
  const match = /^(\d+)([smhd])?$/.exec(raw);
  if (!match) throw new Error(`${name} must look like 15m, 12h or 7d (got "${raw}")`);

  const ms = Number(match[1]) * UNIT_MS[(match[2] ?? "d") as keyof typeof UNIT_MS];
  if (ms <= 0) throw new Error(`${name} must be greater than zero`);
  return ms;
};

const isProd = config.env === "production";

const accessSecret = config.jwt.access_secret;
if (!accessSecret) throw new Error("JWT_ACCESS_SECRET is not set");
if (isProd && accessSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 characters in production");
}

const accessTtlMs = parseDuration("JWT_ACCESS_EXPIRE_IN", config.jwt.access_expire, "3h");
const refreshTtlMs = parseDuration("JWT_REFRESH_EXPIRE_IN", config.jwt.refresh_expire, "7d");
const sessionMaxMs = parseDuration("JWT_SESSION_MAX_AGE", process.env.JWT_SESSION_MAX_AGE, "30d");

if (sessionMaxMs < refreshTtlMs) {
  throw new Error("JWT_SESSION_MAX_AGE must not be shorter than JWT_REFRESH_EXPIRE_IN");
}

export const authConfig = {
  isProd,
  accessSecret,
  accessTtlMs,
  accessTtlSeconds: Math.floor(accessTtlMs / 1000),
  refreshTtlMs, // sliding: each rotation extends the token by this much
  sessionMaxMs, // absolute: a session can never outlive this, however active
  refreshReuseGraceMs: 10_000, // a just-rotated token reused within this window is a race, not theft
  refreshCookiePath: process.env.AUTH_REFRESH_COOKIE_PATH ?? "/api/v1/auth",
};