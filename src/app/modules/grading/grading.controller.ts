import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { GradingService } from "./grading.service";
import type { ClassSettingsQuery } from "./grading.validation";

const reply = (res: Response, statusCode: number, message: string, data: unknown) =>
  sendResponse(res, { statusCode, success: true, message, data });

const schoolOf = (req: Request) => req.auth!.schoolId!;
const scaleIdOf = (req: Request) => req.params.scaleId as string;

const createScale = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.CREATED, "Grading scale created successfully!", await GradingService.createScale(schoolOf(req), req.body));
});

const getScales = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Grading scales retrieved successfully!", await GradingService.getScales(schoolOf(req)));
});

const getScaleById = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Grading scale retrieved successfully!", await GradingService.getScaleById(schoolOf(req), scaleIdOf(req)));
});

const updateScale = catchAsync(async (req: Request, res: Response) => {
  const result = await GradingService.updateScale(schoolOf(req), scaleIdOf(req), req.body);
  reply(res, httpStatus.OK, "Grading scale updated successfully!", result);
});

const copyScale = catchAsync(async (req: Request, res: Response) => {
  const result = await GradingService.copyScale(schoolOf(req), scaleIdOf(req), req.body);
  reply(res, httpStatus.CREATED, "Grading scale copied successfully!", result);
});

const deleteScale = catchAsync(async (req: Request, res: Response) => {
  await GradingService.deleteScale(schoolOf(req), scaleIdOf(req));
  reply(res, httpStatus.OK, "Grading scale deleted successfully!", null);
});

const getClassSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await GradingService.getClassSettings(schoolOf(req), req.query as unknown as ClassSettingsQuery);
  reply(res, httpStatus.OK, "Class result settings retrieved successfully!", result);
});

const setClassSetting = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Class result setting saved successfully!", await GradingService.setClassSetting(schoolOf(req), req.body));
});

export const GradingController = {
  createScale,
  getScales,
  getScaleById,
  updateScale,
  copyScale,
  deleteScale,
  getClassSettings,
  setClassSetting,
};
