import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { ExamResultController } from "./examResult.controller";
import { ExamResultValidation } from "./examResult.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// works out and saves a class's result; marks lock until it is unlocked
router.post(
  "/publish",
  authorize("exam:publish_result"),
  validateRequest({ body: ExamResultValidation.examClass }),
  ExamResultController.publishResult,
);

router.post(
  "/unlock",
  authorize("exam:unlock"),
  validateRequest({ body: ExamResultValidation.examClass }),
  ExamResultController.unlockResult,
);

router.get(
  "/tabulation",
  authorize("exam:view_result"),
  validateRequest({ query: ExamResultValidation.tabulationQuery }),
  ExamResultController.getTabulation,
);

router.get(
  "/marksheet",
  authorize("exam:view_result"),
  validateRequest({ query: ExamResultValidation.marksheetQuery }),
  ExamResultController.getMarksheet,
);

router.get(
  "/summary",
  authorize("exam:view_result"),
  validateRequest({ query: ExamResultValidation.summaryQuery }),
  ExamResultController.getExamSummary,
);

export const examResultRoutes = router;
