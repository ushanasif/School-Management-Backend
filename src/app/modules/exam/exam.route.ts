import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { ExamController, OptionalSubjectController } from "./exam.controller";
import { ExamValidation } from "./exam.validation";

// ---------------------------------------------------------------------- exams

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("exam:create"),
  validateRequest({ body: ExamValidation.createExam }),
  ExamController.createExam,
);

router.get(
  "/",
  authorize("exam:view"),
  validateRequest({ query: ExamValidation.listExamsQuery }),
  ExamController.getExams,
);

router.get(
  "/:examId",
  authorize("exam:view"),
  validateRequest({ params: ExamValidation.examIdParams }),
  ExamController.getExamById,
);

router.patch(
  "/:examId",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examIdParams, body: ExamValidation.updateExam }),
  ExamController.updateExam,
);

router.delete(
  "/:examId",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examIdParams }),
  ExamController.deleteExam,
);

router.post(
  "/:examId/classes",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examIdParams, body: ExamValidation.addClasses }),
  ExamController.addClasses,
);

router.delete(
  "/:examId/classes/:classId",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examClassParams }),
  ExamController.removeClass,
);

// a class's routine: subjects, days, times and marks
router.get(
  "/:examId/classes/:classId/routine",
  authorize("exam:view"),
  validateRequest({ params: ExamValidation.examClassParams }),
  ExamController.getRoutine,
);

router.put(
  "/:examId/classes/:classId/routine",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examClassParams, body: ExamValidation.setRoutine }),
  ExamController.setRoutine,
);

// ROUTINE <-> MARKS_ENTRY
router.post(
  "/:examId/classes/:classId/status",
  authorize("exam:create"),
  validateRequest({ params: ExamValidation.examClassParams, body: ExamValidation.setStatus }),
  ExamController.setStatus,
);

export const examRoutes = router;

// ---------------------------------------------------------- optional subjects

const optionalRouter = express.Router();

optionalRouter.use(authenticate("SCHOOL"));

optionalRouter.get(
  "/",
  authorize("exam:view"),
  validateRequest({ query: ExamValidation.optionalQuery }),
  OptionalSubjectController.getOptionalChoices,
);

optionalRouter.put(
  "/",
  authorize("exam:create"),
  validateRequest({ body: ExamValidation.setOptionalChoices }),
  OptionalSubjectController.setOptionalChoices,
);

export const optionalSubjectRoutes = optionalRouter;
