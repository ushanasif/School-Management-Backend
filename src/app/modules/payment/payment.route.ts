import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("payment:create"),
  validateRequest({ body: PaymentValidation.recordPayment }),
  PaymentController.recordPayment,
);

router.get(
  "/",
  authorize("payment:view"),
  validateRequest({ query: PaymentValidation.listPaymentsQuery }),
  PaymentController.listPayments,
);

// the collection screen: everything the student still owes
router.get(
  "/student/:studentId/payable",
  authorize("payment:create"),
  validateRequest({
    params: PaymentValidation.studentIdParams,
    query: PaymentValidation.payableQuery,
  }),
  PaymentController.getPayableFees,
);

router.get(
  "/student/:studentId",
  authorize("payment:view"),
  validateRequest({
    params: PaymentValidation.studentIdParams,
    query: PaymentValidation.listPaymentsQuery,
  }),
  PaymentController.listStudentPayments,
);

router.get(
  "/:paymentId",
  authorize("payment:view"),
  validateRequest({ params: PaymentValidation.paymentIdParams }),
  PaymentController.getPaymentById,
);

router.post(
  "/:paymentId/cancel",
  authorize("payment:cancel"),
  validateRequest({
    params: PaymentValidation.paymentIdParams,
    body: PaymentValidation.cancelPayment,
  }),
  PaymentController.cancelPayment,
);

export const paymentRoutes = router;