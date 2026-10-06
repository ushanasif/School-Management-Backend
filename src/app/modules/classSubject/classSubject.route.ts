import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { ClassSubjectController } from "./classSubject.controller";
import { ClassSubjectValidation } from "./classSubject.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("class_subject:manage"),
  validateRequest({ body: ClassSubjectValidation.assignSubjects }),
  ClassSubjectController.assignSubjects,
);

router.get(
  "/",
  authorize("class_subject:view"),
  validateRequest({ query: ClassSubjectValidation.listQuery }),
  ClassSubjectController.getClassSubjects,
);

router.patch(
  "/:classSubjectId",
  authorize("class_subject:manage"),
  validateRequest({
    params: ClassSubjectValidation.classSubjectIdParams,
    body: ClassSubjectValidation.updateClassSubject,
  }),
  ClassSubjectController.updateClassSubject,
);

router.delete(
  "/:classSubjectId",
  authorize("class_subject:manage"),
  validateRequest({ params: ClassSubjectValidation.classSubjectIdParams }),
  ClassSubjectController.removeClassSubject,
);

// full marks, pass marks, parts and grading scale: part of the result setup
router.put(
  "/:classSubjectId/marks",
  authorize("grading:manage"),
  validateRequest({ params: ClassSubjectValidation.classSubjectIdParams, body: ClassSubjectValidation.setMarks }),
  ClassSubjectController.setMarks,
);

export const classSubjectRoutes = router;
