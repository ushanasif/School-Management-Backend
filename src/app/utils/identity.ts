import { z } from "zod";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

/** "01712-345678", "+8801712345678", "৮৮০১৭১২৩৪৫৬৭৮" -> "+8801712345678", or null. */
export const normalizeBdPhone = (input: string): string | null => {
  const compact = input
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[\s\-().]/g, "");

  let local: string; // 11 digits starting with 01
  if (/^\+8801\d{9}$/.test(compact)) local = `0${compact.slice(4)}`;
  else if (/^8801\d{9}$/.test(compact)) local = `0${compact.slice(3)}`;
  else if (/^01\d{9}$/.test(compact)) local = compact;
  else return null;

  return /^01[3-9]\d{8}$/.test(local) ? `+88${local}` : null;
};

/** Email (lowercased) or Bangladeshi mobile (+8801XXXXXXXXX), or null. */
export const normalizeLoginIdentifier = (value: string): string | null => {
  if (value.includes("@")) {
    const email = normalizeEmail(value);
    return EMAIL_PATTERN.test(email) ? email : null;
  }
  return normalizeBdPhone(value);
};

export const emailSchema = z
  .string({ error: "Email is required!" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

/** Accepts 01712345678, +8801712345678, 8801712345678; stores +8801712345678. */
export const bdPhoneSchema = z
  .string({ error: "Phone is required!" })
  .trim()
  .refine(
    (v) => normalizeBdPhone(v) !== null,
    "Enter a valid Bangladeshi mobile number (e.g. 01712345678)",
  )
  .transform((v) => normalizeBdPhone(v) as string);

export const loginIdentifierSchema = z
  .string({ error: "Email or mobile number is required!" })
  .trim()
  .min(1, "Email or mobile number is required!")
  .refine((v) => normalizeLoginIdentifier(v) !== null, "Enter a valid email or mobile number")
  .transform((v) => normalizeLoginIdentifier(v) as string);