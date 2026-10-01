import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { FeeTypeService } from "./feeType.service";
import { FeeTypeValidation } from "./feeType.validation";

const createFeeType = catchAsync(async (req: Request, res: Response) => {
  const result = await FeeTypeService.createFeeType(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Fee type created successfully!",
    data: result,
  });
});

const getFeeTypes = catchAsync(async (req: Request, res: Response) => {
  const query = FeeTypeValidation.listFeeTypesQuery.parse(req.query);
  const result = await FeeTypeService.getFeeTypes(req.auth!.schoolId!, {
    includeInactive: query.includeInactive === "true",
    frequency: query.frequency,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fee types retrieved successfully!",
    data: result,
  });
});

const updateFeeType = catchAsync(async (req: Request, res: Response) => {
  const result = await FeeTypeService.updateFeeType(
    req.auth!.schoolId!,
    req.params.feeTypeId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fee type updated successfully!",
    data: result,
  });
});

export const FeeTypeController = { createFeeType, getFeeTypes, updateFeeType };