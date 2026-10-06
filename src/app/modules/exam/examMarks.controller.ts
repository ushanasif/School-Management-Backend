import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ExamMarksService } from "./examMarks.service";
import type { GridQuery, MineQuery, ProgressQuery, SheetQuery, StudentQuery } from "./examMarks.validation";

const reply = (res: Response, message: string, data: unknown) =>
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message, data });

const getSheet = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Marks sheet retrieved successfully!", await ExamMarksService.getSheet(req.auth!, req.query as unknown as SheetQuery));
});

const saveSheet = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Marks saved successfully!", await ExamMarksService.saveSheet(req.auth!, req.body));
});

const getGrid = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Marks grid retrieved successfully!", await ExamMarksService.getGrid(req.auth!.schoolId!, req.query as unknown as GridQuery));
});

const saveGrid = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Marks saved successfully!", await ExamMarksService.saveGrid(req.auth!, req.body));
});

const getStudentMarks = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamMarksService.getStudentMarks(req.auth!.schoolId!, req.query as unknown as StudentQuery);
  reply(res, "Student marks retrieved successfully!", result);
});

const saveStudentMarks = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Marks saved successfully!", await ExamMarksService.saveStudentMarks(req.auth!, req.body));
});

const getProgress = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamMarksService.getProgress(req.auth!.schoolId!, req.query as unknown as ProgressQuery);
  reply(res, "Marks entry progress retrieved successfully!", result);
});

const getMySheets = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Your marks sheets retrieved successfully!", await ExamMarksService.getMySheets(req.auth!, req.query as unknown as MineQuery));
});

export const ExamMarksController = {
  getSheet,
  saveSheet,
  getGrid,
  saveGrid,
  getStudentMarks,
  saveStudentMarks,
  getProgress,
  getMySheets,
};
