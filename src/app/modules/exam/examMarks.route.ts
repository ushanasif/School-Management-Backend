import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { ExamMarksController } from "./examMarks.controller";
import { ExamMarksValidation } from "./examMarks.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// the logged-in teacher's own sheets (their subjects and sections)
router.get(
  "/mine",
  validateRequest({ query: ExamMarksValidation.mineQuery }),
  ExamMarksController.getMySheets,
);

// marks sheet of one subject in one section. Who may enter is checked in the service:
// the subject's teachers for their own sections, or anyone with exam:enter_marks
router.get(
  "/sheet",
  validateRequest({ query: ExamMarksValidation.sheetQuery }),
  ExamMarksController.getSheet,
);

router.put(
  "/sheet",
  validateRequest({ body: ExamMarksValidation.saveSheet }),
  ExamMarksController.saveSheet,
);

// ------------------------------------------ admins: bulk entry (exam:enter_marks)

// a section's whole grid: every student x every subject
router.get(
  "/grid",
  authorize("exam:enter_marks"),
  validateRequest({ query: ExamMarksValidation.gridQuery }),
  ExamMarksController.getGrid,
);

router.put(
  "/grid",
  authorize("exam:enter_marks"),
  validateRequest({ body: ExamMarksValidation.saveGrid }),
  ExamMarksController.saveGrid,
);

// one student, all their subjects
router.get(
  "/student",
  authorize("exam:enter_marks"),
  validateRequest({ query: ExamMarksValidation.studentQuery }),
  ExamMarksController.getStudentMarks,
);

router.put(
  "/student",
  authorize("exam:enter_marks"),
  validateRequest({ body: ExamMarksValidation.saveStudent }),
  ExamMarksController.saveStudentMarks,
);

router.get(
  "/progress",
  authorize("exam:view"),
  validateRequest({ query: ExamMarksValidation.progressQuery }),
  ExamMarksController.getProgress,
);

export const examMarksRoutes = router;
