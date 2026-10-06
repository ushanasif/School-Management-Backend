import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ScheduleService } from "./schedule.service";
import type { HoursQuery, ListOverridesQuery } from "./schedule.type";

const createOverride = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleService.createOverride(req.auth!.schoolId!, req.auth!.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Schedule change created successfully!",
    data: result,
  });
});

const getOverrides = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleService.getOverrides(
    req.auth!.schoolId!,
    req.query as unknown as ListOverridesQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule changes retrieved successfully!",
    data: result,
  });
});

const getOverrideById = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleService.getOverrideById(req.auth!.schoolId!, req.params.overrideId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule change retrieved successfully!",
    data: result,
  });
});

const updateOverride = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleService.updateOverride(
    req.auth!.schoolId!,
    req.params.overrideId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule change updated successfully!",
    data: result,
  });
});

const deleteOverride = catchAsync(async (req: Request, res: Response) => {
  await ScheduleService.deleteOverride(req.auth!.schoolId!, req.params.overrideId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule change deleted successfully!",
    data: null,
  });
});

const getHours = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleService.getHours(req.auth!.schoolId!, req.query as unknown as HoursQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Class hours retrieved successfully!",
    data: result,
  });
});

export const ScheduleController = {
  createOverride,
  getOverrides,
  getOverrideById,
  updateOverride,
  deleteOverride,
  getHours,
};
