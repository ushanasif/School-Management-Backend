import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ExamService } from "./exam.service";
import type { ListExamsQuery, OptionalQuery } from "./exam.validation";
import { OptionalSubjectService } from "./optionalSubject.service";

const reply = (res: Response, statusCode: number, message: string, data: unknown) =>
  sendResponse(res, { statusCode, success: true, message, data });

const schoolOf = (req: Request) => req.auth!.schoolId!;
const examIdOf = (req: Request) => req.params.examId as string;
const classIdOf = (req: Request) => req.params.classId as string;

// ---------------------------------------------------------------------- exams

const createExam = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamService.createExam(schoolOf(req), req.auth!.userId, req.body);
  reply(res, httpStatus.CREATED, "Exam created successfully!", result);
});

const getExams = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamService.getExams(schoolOf(req), req.query as unknown as ListExamsQuery);
  reply(res, httpStatus.OK, "Exams retrieved successfully!", result);
});

const getExamById = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Exam retrieved successfully!", await ExamService.getExamById(schoolOf(req), examIdOf(req)));
});

const updateExam = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Exam updated successfully!", await ExamService.updateExam(schoolOf(req), examIdOf(req), req.body));
});

const deleteExam = catchAsync(async (req: Request, res: Response) => {
  await ExamService.deleteExam(schoolOf(req), examIdOf(req));
  reply(res, httpStatus.OK, "Exam deleted successfully!", null);
});

const addClasses = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Classes added to the exam!", await ExamService.addClasses(schoolOf(req), examIdOf(req), req.body));
});

const removeClass = catchAsync(async (req: Request, res: Response) => {
  await ExamService.removeClass(schoolOf(req), examIdOf(req), classIdOf(req));
  reply(res, httpStatus.OK, "Class removed from the exam!", null);
});

// -------------------------------------------------------------------- routine

const getRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamService.getRoutine(schoolOf(req), examIdOf(req), classIdOf(req));
  reply(res, httpStatus.OK, "Exam routine retrieved successfully!", result);
});

const setRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamService.setRoutine(schoolOf(req), examIdOf(req), classIdOf(req), req.body);
  reply(res, httpStatus.OK, "Exam routine saved successfully!", result);
});

const setStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamService.setStatus(schoolOf(req), examIdOf(req), classIdOf(req), req.body);
  reply(res, httpStatus.OK, "Exam status updated successfully!", result);
});

// --------------------------------------------------------- optional subjects

const getOptionalChoices = catchAsync(async (req: Request, res: Response) => {
  const result = await OptionalSubjectService.getChoices(schoolOf(req), req.query as unknown as OptionalQuery);
  reply(res, httpStatus.OK, "Optional subject choices retrieved successfully!", result);
});

const setOptionalChoices = catchAsync(async (req: Request, res: Response) => {
  const result = await OptionalSubjectService.setChoices(schoolOf(req), req.auth!.userId, req.body);
  reply(res, httpStatus.OK, "Optional subject choices saved successfully!", result);
});

export const ExamController = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  addClasses,
  removeClass,
  getRoutine,
  setRoutine,
  setStatus,
};

export const OptionalSubjectController = {
  getOptionalChoices,
  setOptionalChoices,
};
