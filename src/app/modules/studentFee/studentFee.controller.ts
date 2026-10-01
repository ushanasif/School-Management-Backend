import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { StudentFeeService } from "./studentFee.service";
import { StudentFeeValidation } from "./studentFee.validation";

const listFees = catchAsync(async (req: Request, res: Response) => {
  const query = StudentFeeValidation.listFeesQuery.parse(req.query);
  const result = await StudentFeeService.listFees(req.auth!.schoolId!, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fees retrieved successfully!",
    data: result,
  });
});

const listStudentFees = catchAsync(async (req: Request, res: Response) => {
  const query = StudentFeeValidation.listFeesQuery.parse(req.query);
  const result = await StudentFeeService.listFees(req.auth!.schoolId!, {
    ...query,
    studentId: req.params.studentId as string, // the path always wins over the query
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student fees retrieved successfully!",
    data: result,
  });
});

const createCustomFee = catchAsync(async (req: Request, res: Response) => {
  const result = await StudentFeeService.createCustomStudentFee(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Custom fee added successfully!",
    data: result,
  });
});

const removeCustomFee = catchAsync(async (req: Request, res: Response) => {
  const result = await StudentFeeService.removeCustomStudentFee(
    req.auth!.schoolId!,
    req.params.studentFeeId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Custom fee removed successfully!",
    data: result,
  });
});

const applyDiscount = catchAsync(async (req: Request, res: Response) => {
  const result = await StudentFeeService.applyDiscount(
    req.auth!.schoolId!,
    req.params.studentFeeId as string,
    req.auth!.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Discount applied successfully!",
    data: result,
  });
});

const applyBulkDiscount = catchAsync(async (req: Request, res: Response) => {
  const result = await StudentFeeService.applyDiscountForFeeType(
    req.auth!.schoolId!,
    req.auth!.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Discounts applied successfully!",
    data: result,
  });
});

export const StudentFeeController = {
  listFees,
  listStudentFees,
  createCustomFee,
  removeCustomFee,
  applyDiscount,
  applyBulkDiscount,
};