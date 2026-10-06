import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { CalendarService } from "./calendar.service";
import type { CalendarQuery, EntriesQuery, NationalHolidaysQuery } from "./calendar.validation";

const reply = (res: Response, statusCode: number, message: string, data: unknown) =>
  sendResponse(res, { statusCode, success: true, message, data });

const schoolOf = (req: Request) => req.auth!.schoolId!;

// ------------------------------------------------------------ weekly holidays

const getWeeklyRules = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Weekly holidays retrieved successfully!", await CalendarService.getWeeklyRules(schoolOf(req)));
});

const setWeeklyRule = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.setWeeklyRule(schoolOf(req), req.auth!.userId, req.body);
  reply(res, httpStatus.OK, "Weekly holidays saved successfully!", result);
});

const deleteWeeklyRule = catchAsync(async (req: Request, res: Response) => {
  await CalendarService.deleteWeeklyRule(schoolOf(req), req.params.ruleId as string);
  reply(res, httpStatus.OK, "Weekly holiday rule deleted successfully!", null);
});

// ---------------------------------------------------- national holidays (school)

const getNationalHolidays = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.getNationalHolidaysForSchool(
    schoolOf(req),
    req.query as unknown as NationalHolidaysQuery,
  );
  reply(res, httpStatus.OK, "National holidays retrieved successfully!", result);
});

const excludeNationalHoliday = catchAsync(async (req: Request, res: Response) => {
  await CalendarService.excludeNationalHoliday(schoolOf(req), req.auth!.userId, req.params.nationalHolidayId as string);
  reply(res, httpStatus.OK, "The school stays open on this national holiday", null);
});

const restoreNationalHoliday = catchAsync(async (req: Request, res: Response) => {
  await CalendarService.restoreNationalHoliday(schoolOf(req), req.params.nationalHolidayId as string);
  reply(res, httpStatus.OK, "The national holiday is a day off again", null);
});

// -------------------------------------------------------------- school entries

const createEntry = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.createEntry(schoolOf(req), req.auth!.userId, req.body);
  reply(res, httpStatus.CREATED, "Calendar entry created successfully!", result);
});

const getEntries = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.getEntries(schoolOf(req), req.query as unknown as EntriesQuery);
  reply(res, httpStatus.OK, "Calendar entries retrieved successfully!", result);
});

const getEntryById = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.getEntryById(schoolOf(req), req.params.entryId as string);
  reply(res, httpStatus.OK, "Calendar entry retrieved successfully!", result);
});

const updateEntry = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.updateEntry(schoolOf(req), req.params.entryId as string, req.body);
  reply(res, httpStatus.OK, "Calendar entry updated successfully!", result);
});

const deleteEntry = catchAsync(async (req: Request, res: Response) => {
  await CalendarService.deleteEntry(schoolOf(req), req.params.entryId as string);
  reply(res, httpStatus.OK, "Calendar entry deleted successfully!", null);
});

// --------------------------------------------------------------- calendar view

const getCalendar = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.getCalendar(schoolOf(req), req.query as unknown as CalendarQuery);
  reply(res, httpStatus.OK, "Calendar retrieved successfully!", result);
});

// ------------------------------------------------- national holidays (platform)

const createNationalHoliday = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.CREATED, "National holiday created successfully!", await CalendarService.createNationalHoliday(req.body));
});

const getNationalHolidaysForPlatform = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.getNationalHolidaysForPlatform(req.query as unknown as NationalHolidaysQuery);
  reply(res, httpStatus.OK, "National holidays retrieved successfully!", result);
});

const updateNationalHoliday = catchAsync(async (req: Request, res: Response) => {
  const result = await CalendarService.updateNationalHoliday(req.params.nationalHolidayId as string, req.body);
  reply(res, httpStatus.OK, "National holiday updated successfully!", result);
});

const deleteNationalHoliday = catchAsync(async (req: Request, res: Response) => {
  await CalendarService.deleteNationalHoliday(req.params.nationalHolidayId as string);
  reply(res, httpStatus.OK, "National holiday deleted successfully!", null);
});

export const CalendarController = {
  getWeeklyRules,
  setWeeklyRule,
  deleteWeeklyRule,
  getNationalHolidays,
  excludeNationalHoliday,
  restoreNationalHoliday,
  createEntry,
  getEntries,
  getEntryById,
  updateEntry,
  deleteEntry,
  getCalendar,
};

export const NationalHolidayController = {
  createNationalHoliday,
  getNationalHolidays: getNationalHolidaysForPlatform,
  updateNationalHoliday,
  deleteNationalHoliday,
};
