import { z } from "zod";

/** 24-hour "HH:mm". As text, "08:00" < "11:30" < "14:00" compares correctly. */
export const timeSchema = z
  .string({ error: "Time is required!" })
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:mm, for example 08:00 or 14:30");

/** A calendar date "YYYY-MM-DD", turned into midnight UTC (stored in DATE columns). */
export const dateOnlySchema = z
  .string({ error: "Date is required!" })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD")
  // rejects dates that don't exist, like 2027-02-30
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Enter a real date")
  .transform((v) => new Date(`${v}T00:00:00Z`));

/** "YYYY-MM-DD" of a date, by its UTC calendar day. */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** The end of a Bangladesh calendar day (UTC+6), for comparing a date with real timestamps. */
export const endOfBangladeshDay = (day: Date) => new Date(day.getTime() + 86_400_000 - 6 * 3_600_000);

/** Today's calendar date in Bangladesh, as midnight UTC (like dateOnlySchema gives). */
export const todayInBangladesh = () => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()); // "YYYY-MM-DD"
  return new Date(`${day}T00:00:00Z`);
};
