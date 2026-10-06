import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ClassSubjectService } from "./classSubject.service";
import type { ListClassSubjectsQuery } from "./classSubject.type";

const assignSubjects = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassSubjectService.assignSubjects(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Subjects assigned successfully!",
    data: result,
  });
});

const getClassSubjects = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassSubjectService.getClassSubjects(
    req.auth!.schoolId!,
    req.query as unknown as ListClassSubjectsQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Class subjects retrieved successfully!",
    data: result,
  });
});

const updateClassSubject = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassSubjectService.updateClassSubject(
    req.auth!.schoolId!,
    req.params.classSubjectId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Class subject updated successfully!",
    data: result,
  });
});

const removeClassSubject = catchAsync(async (req: Request, res: Response) => {
  await ClassSubjectService.removeClassSubject(req.auth!.schoolId!, req.params.classSubjectId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subject removed from the class!",
    data: null,
  });
});

const setMarks = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassSubjectService.setMarks(req.auth!.schoolId!, req.params.classSubjectId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Marks setup saved successfully!",
    data: result,
  });
});

export const ClassSubjectController = {
  setMarks,
  assignSubjects,
  getClassSubjects,
  updateClassSubject,
  removeClassSubject,
};
