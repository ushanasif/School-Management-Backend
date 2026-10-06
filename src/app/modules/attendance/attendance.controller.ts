import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { AttendanceService } from "./attendance.service";
import type { DayQuery, RangeQuery, RegisterQuery, StudentSheetQuery, TeacherSheetQuery } from "./attendance.validation";

const reply = (res: Response, message: string, data: unknown) =>
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message, data });

const schoolOf = (req: Request) => req.auth!.schoolId!;

// ------------------------------------------------------------------ students

const getStudentSheet = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getStudentSheet(req.auth!, req.query as unknown as StudentSheetQuery);
  reply(res, "Roll call retrieved successfully!", result);
});

const saveStudentSheet = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Attendance saved successfully!", await AttendanceService.saveStudentSheet(req.auth!, req.body));
});

const getDaySummary = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getDaySummary(schoolOf(req), req.query as unknown as DayQuery);
  reply(res, "Attendance summary retrieved successfully!", result);
});

const getAbsentees = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getAbsentees(schoolOf(req), req.query as unknown as DayQuery);
  reply(res, "Absent students retrieved successfully!", result);
});

const getStudentReport = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getStudentReport(
    schoolOf(req),
    req.params.studentId as string,
    req.query as unknown as RangeQuery,
  );
  reply(res, "Student attendance retrieved successfully!", result);
});

const getSectionRegister = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getSectionRegister(
    schoolOf(req),
    req.params.sectionId as string,
    req.query as unknown as RegisterQuery,
  );
  reply(res, "Attendance register retrieved successfully!", result);
});

// ------------------------------------------------------------------ teachers

const getTeacherSheet = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getTeacherSheet(req.auth!, req.query as unknown as TeacherSheetQuery);
  reply(res, "Teacher attendance retrieved successfully!", result);
});

const saveTeacherSheet = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Teacher attendance saved successfully!", await AttendanceService.saveTeacherSheet(req.auth!, req.body));
});

const getTeacherReport = catchAsync(async (req: Request, res: Response) => {
  const result = await AttendanceService.getTeacherReport(
    schoolOf(req),
    req.params.teacherId as string,
    req.query as unknown as RangeQuery,
  );
  reply(res, "Teacher attendance retrieved successfully!", result);
});

export const AttendanceController = {
  getStudentSheet,
  saveStudentSheet,
  getDaySummary,
  getAbsentees,
  getStudentReport,
  getSectionRegister,
  getTeacherSheet,
  saveTeacherSheet,
  getTeacherReport,
};
