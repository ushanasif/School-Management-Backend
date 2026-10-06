import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { TeacherService } from "./teacher.service";
import type { ListTeachersQuery, ScheduleQuery, YearQuery } from "./teacher.type";

const createTeacher = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.createTeacher(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: result.rejoined ? httpStatus.OK : httpStatus.CREATED,
    success: true,
    message: result.rejoined ? "Teacher rejoined successfully!" : "Teacher added successfully!",
    data: result,
  });
});

const getTeachers = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.getTeachers(req.auth!.schoolId!, req.query as unknown as ListTeachersQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teachers retrieved successfully!",
    data: result,
  });
});

const getTeacherById = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.getTeacherById(
    req.auth!.schoolId!,
    req.params.teacherId as string,
    req.query as unknown as YearQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teacher retrieved successfully!",
    data: result,
  });
});

const updateTeacher = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.updateTeacher(req.auth!.schoolId!, req.params.teacherId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teacher updated successfully!",
    data: result,
  });
});

const deactivateTeacher = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.deactivateTeacher(
    req.auth!.schoolId!,
    req.params.teacherId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teacher deactivated successfully!",
    data: result,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.resetPassword(req.auth!.schoolId!, req.params.teacherId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully!",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.getMyProfile(req.auth!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully!",
    data: result,
  });
});

const getMyAssignments = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.getMyAssignments(req.auth!, req.query as unknown as YearQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignments retrieved successfully!",
    data: result,
  });
});

const getMySchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await TeacherService.getMySchedule(req.auth!, req.query as unknown as ScheduleQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule retrieved successfully!",
    data: result,
  });
});

export const TeacherController = {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deactivateTeacher,
  resetPassword,
  getMyProfile,
  getMyAssignments,
  getMySchedule,
};
