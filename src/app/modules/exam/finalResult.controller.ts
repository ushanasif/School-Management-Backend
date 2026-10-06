import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { FinalResultService } from "./finalResult.service";
import type { FinalListQuery, FinalMarksheetQuery, FinalTabulationQuery } from "./finalResult.validation";

const reply = (res: Response, statusCode: number, message: string, data: unknown) =>
  sendResponse(res, { statusCode, success: true, message, data });

const schoolOf = (req: Request) => req.auth!.schoolId!;
const formulaIdOf = (req: Request) => req.params.formulaId as string;

const createFormula = catchAsync(async (req: Request, res: Response) => {
  const result = await FinalResultService.createFormula(schoolOf(req), req.auth!.userId, req.body);
  reply(res, httpStatus.CREATED, "Final result formula created successfully!", result);
});

const getFormulas = catchAsync(async (req: Request, res: Response) => {
  const result = await FinalResultService.getFormulas(schoolOf(req), req.query as unknown as FinalListQuery);
  reply(res, httpStatus.OK, "Final result formulas retrieved successfully!", result);
});

const getFormulaById = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Final result formula retrieved successfully!", await FinalResultService.getFormulaById(schoolOf(req), formulaIdOf(req)));
});

const updateFormula = catchAsync(async (req: Request, res: Response) => {
  const result = await FinalResultService.updateFormula(schoolOf(req), formulaIdOf(req), req.body);
  reply(res, httpStatus.OK, "Final result formula updated successfully!", result);
});

const deleteFormula = catchAsync(async (req: Request, res: Response) => {
  await FinalResultService.deleteFormula(schoolOf(req), formulaIdOf(req));
  reply(res, httpStatus.OK, "Final result formula deleted successfully!", null);
});

const publishFinal = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Final result published successfully!", await FinalResultService.publishFinal(req.auth!, formulaIdOf(req)));
});

const unlockFinal = catchAsync(async (req: Request, res: Response) => {
  reply(res, httpStatus.OK, "Final result unlocked", await FinalResultService.unlockFinal(schoolOf(req), formulaIdOf(req)));
});

const getTabulation = catchAsync(async (req: Request, res: Response) => {
  const result = await FinalResultService.getTabulation(schoolOf(req), formulaIdOf(req), req.query as unknown as FinalTabulationQuery);
  reply(res, httpStatus.OK, "Final tabulation sheet retrieved successfully!", result);
});

const getMarksheet = catchAsync(async (req: Request, res: Response) => {
  const result = await FinalResultService.getMarksheet(schoolOf(req), formulaIdOf(req), req.query as unknown as FinalMarksheetQuery);
  reply(res, httpStatus.OK, "Final mark sheet retrieved successfully!", result);
});

export const FinalResultController = {
  createFormula,
  getFormulas,
  getFormulaById,
  updateFormula,
  deleteFormula,
  publishFinal,
  unlockFinal,
  getTabulation,
  getMarksheet,
};
