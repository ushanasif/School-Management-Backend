import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { ExpenseService } from "./expense.service";
import type { ListExpensesQuery } from "./expense.type";

const createExpense = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.createExpense(req.auth!.schoolId!, req.auth!.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Expense recorded successfully!",
    data: result,
  });
});

const listExpenses = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.listExpenses(
    req.auth!.schoolId!,
    req.query as unknown as ListExpensesQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expenses retrieved successfully!",
    data: result,
  });
});

const getCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.getCategories(req.auth!.schoolId!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense categories retrieved successfully!",
    data: result,
  });
});

const voidExpense = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.voidExpense(
    req.auth!.schoolId!,
    req.auth!.userId,
    req.params.expenseId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense voided successfully!",
    data: result,
  });
});

export const ExpenseController = { createExpense, listExpenses, getCategories, voidExpense };