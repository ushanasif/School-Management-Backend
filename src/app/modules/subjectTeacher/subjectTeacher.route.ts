import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { SubjectTeacherController } from "./subjectTeacher.controller";
import { SubjectTeacherValidation } from "./subjectTeacher.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// replaces the teachers of one subject in one section
router.put(
  "/",
  authorize("teacher:assign"),
  validateRequest({ body: SubjectTeacherValidation.setSubjectTeachers }),
  SubjectTeacherController.setSubjectTeachers,
);

router.get(
  "/",
  authorize("teacher:view"),
  validateRequest({ query: SubjectTeacherValidation.listQuery }),
  SubjectTeacherController.getSubjectTeachers,
);

export const subjectTeacherRoutes = router;
