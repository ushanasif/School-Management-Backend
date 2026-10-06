import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { type ListSubjectTeachersQuery, SubjectTeacherService } from "./subjectTeacher.service";

const setSubjectTeachers = catchAsync(async (req: Request, res: Response) => {
  const result = await SubjectTeacherService.setSubjectTeachers(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subject teachers saved successfully!",
    data: result,
  });
});

const getSubjectTeachers = catchAsync(async (req: Request, res: Response) => {
  const result = await SubjectTeacherService.getSubjectTeachers(
    req.auth!.schoolId!,
    req.query as unknown as ListSubjectTeachersQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subject teachers retrieved successfully!",
    data: result,
  });
});

export const SubjectTeacherController = {
  setSubjectTeachers,
  getSubjectTeachers,
};
