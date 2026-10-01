import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { StudentController } from "./student.controller";
import { StudentValidation } from "./student.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("student:create"),
  validateRequest({ body: StudentValidation.createStudent }),
  StudentController.createStudent,
);

router.get(
  "/",
  authorize("student:view"),
  validateRequest({ query: StudentValidation.listStudentsQuery }),
  StudentController.getStudents,
);

router.get(
  "/:studentId",
  authorize("student:view"),
  validateRequest({ params: StudentValidation.studentIdParams }),
  StudentController.getStudentById,
);

router.patch(
  "/:studentId",
  authorize("student:update"),
  validateRequest({
    params: StudentValidation.studentIdParams,
    body: StudentValidation.updateStudent,
  }),
  StudentController.updateStudent,
);

router.post(
  "/:studentId/reset-password",
  authorize("student:reset_password"),
  validateRequest({ params: StudentValidation.studentIdParams }),
  StudentController.resetGuardianPassword,
);

export const studentRoutes = router;