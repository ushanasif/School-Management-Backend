import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { StudentFeeController } from "./studentFee.controller";
import { StudentFeeValidation } from "./studentFee.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.get(
  "/",
  authorize("student_fee:view"),
  validateRequest({ query: StudentFeeValidation.listFeesQuery }),
  StudentFeeController.listFees,
);

router.get(
  "/student/:studentId",
  authorize("student_fee:view"),
  validateRequest({
    params: StudentFeeValidation.studentIdParams,
    query: StudentFeeValidation.listFeesQuery,
  }),
  StudentFeeController.listStudentFees,
);

router.post(
  "/custom",
  authorize("student_fee:create_custom"),
  validateRequest({ body: StudentFeeValidation.createCustomFee }),
  StudentFeeController.createCustomFee,
);

router.delete(
  "/custom/:studentFeeId",
  authorize("student_fee:create_custom"),
  validateRequest({ params: StudentFeeValidation.studentFeeIdParams }),
  StudentFeeController.removeCustomFee,
);

router.post(
  "/discount/by-fee-type",
  authorize("student_fee:discount"),
  validateRequest({ body: StudentFeeValidation.bulkDiscount }),
  StudentFeeController.applyBulkDiscount,
);

router.patch(
  "/:studentFeeId/discount",
  authorize("student_fee:discount"),
  validateRequest({
    params: StudentFeeValidation.studentFeeIdParams,
    body: StudentFeeValidation.applyDiscount,
  }),
  StudentFeeController.applyDiscount,
);

export const studentFeeRoutes = router;