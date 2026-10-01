import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { FundService } from "./fund.service";
import { FundValidation } from "./fund.validation";

const createFund = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.createFund(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Fund created successfully!",
    data: result,
  });
});

const getFunds = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.getFunds(req.auth!.schoolId!, {
    includeInactive: req.query.includeInactive === "true",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Funds retrieved successfully!",
    data: result,
  });
});

const getFundById = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.getFundById(
    req.auth!.schoolId!,
    req.params.fundId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fund retrieved successfully!",
    data: result,
  });
});

const updateFund = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.updateFund(
    req.auth!.schoolId!,
    req.params.fundId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fund updated successfully!",
    data: result,
  });
});

const deposit = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.deposit(
    req.auth!.schoolId!,
    req.params.fundId as string,
    req.auth!.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Money added to fund successfully!",
    data: result,
  });
});

const transfer = catchAsync(async (req: Request, res: Response) => {
  const result = await FundService.transfer(
    req.auth!.schoolId!,
    req.auth!.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Transfer completed successfully!",
    data: result,
  });
});

const getLedger = catchAsync(async (req: Request, res: Response) => {
  // parsed again here so page/limit/dates arrive as numbers/Dates, whatever
  // validateRequest does with req.query
  const query = FundValidation.ledgerQuery.parse(req.query);
  const result = await FundService.getLedger(req.auth!.schoolId!, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ledger retrieved successfully!",
    data: result,
  });
});

export const FundController = {
  createFund,
  getFunds,
  getFundById,
  updateFund,
  deposit,
  transfer,
  getLedger,
};