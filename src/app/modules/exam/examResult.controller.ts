import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ExamResultService } from "./examResult.service";
import type { MarksheetQuery, SummaryQuery, TabulationQuery } from "./examResult.validation";

const reply = (res: Response, message: string, data: unknown) =>
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message, data });

const publishResult = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Result published successfully!", await ExamResultService.publishResult(req.auth!, req.body));
});

const unlockResult = catchAsync(async (req: Request, res: Response) => {
  reply(res, "Result unlocked: marks can be changed again", await ExamResultService.unlockResult(req.auth!.schoolId!, req.body));
});

const getTabulation = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamResultService.getTabulation(req.auth!.schoolId!, req.query as unknown as TabulationQuery);
  reply(res, "Tabulation sheet retrieved successfully!", result);
});

const getMarksheet = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamResultService.getMarksheet(req.auth!.schoolId!, req.query as unknown as MarksheetQuery);
  reply(res, "Mark sheet retrieved successfully!", result);
});

const getExamSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await ExamResultService.getExamSummary(req.auth!.schoolId!, req.query as unknown as SummaryQuery);
  reply(res, "Result summary retrieved successfully!", result);
});

export const ExamResultController = { publishResult, unlockResult, getTabulation, getMarksheet, getExamSummary };
