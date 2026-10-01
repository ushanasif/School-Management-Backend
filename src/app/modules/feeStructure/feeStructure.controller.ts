import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { FeeStructureService } from "./feeStructure.service";
import { FeeStructureValidation } from "./feeStructure.validation";

const createFeeStructure = catchAsync(async (req: Request, res: Response) => {
  const result = await FeeStructureService.createFeeStructure(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Fee structure saved successfully!",
    data: result,
  });
});

const getFeeStructures = catchAsync(async (req: Request, res: Response) => {
  const query = FeeStructureValidation.listFeeStructuresQuery.parse(req.query);
  const result = await FeeStructureService.getFeeStructures(req.auth!.schoolId!, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fee structures retrieved successfully!",
    data: result,
  });
});

const syncFeeStructure = catchAsync(async (req: Request, res: Response) => {
  const result = await FeeStructureService.syncFeeStructure(
    req.auth!.schoolId!,
    req.params.feeStructureId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fee structure synced successfully!",
    data: result,
  });
});

export const FeeStructureController = { createFeeStructure, getFeeStructures, syncFeeStructure };