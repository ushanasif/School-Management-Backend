import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { PaymentService } from "./payment.service";
import type { ListPaymentsQuery } from "./payment.type";

// validateRequest has already replaced req.query with the parsed values

const getPayableFees = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getPayableFees(
    req.auth!.schoolId!,
    req.params.studentId as string,
    { academicYearId: req.query.academicYearId as string | undefined },
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payable fees retrieved successfully!",
    data: result,
  });
});

const recordPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.recordPayment(req.auth!.schoolId!, req.auth!.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment recorded successfully!",
    data: result,
  });
});

const cancelPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.cancelPayment(
    req.auth!.schoolId!,
    req.auth!.userId,
    req.params.paymentId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment cancelled successfully!",
    data: result,
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getPaymentById(
    req.auth!.schoolId!,
    req.params.paymentId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully!",
    data: result,
  });
});

const listPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.listPayments(
    req.auth!.schoolId!,
    req.query as unknown as ListPaymentsQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully!",
    data: result,
  });
});

const listStudentPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.listPayments(req.auth!.schoolId!, {
    ...(req.query as unknown as ListPaymentsQuery),
    studentId: req.params.studentId as string, // the path always wins over the query
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student payments retrieved successfully!",
    data: result,
  });
});

export const PaymentController = {
  getPayableFees,
  recordPayment,
  cancelPayment,
  getPaymentById,
  listPayments,
  listStudentPayments,
};