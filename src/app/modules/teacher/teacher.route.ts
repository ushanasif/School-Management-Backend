import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { TeacherController } from "./teacher.controller";
import { TeacherValidation } from "./teacher.validation";

const router = express.Router();

// -------------------------------------------------------- the teacher's own
// a logged-in teacher's own data: no permission needed, only a real membership
// (a platform admin working through X-School-Id is not a teacher)

const teacherSelf = authenticate("SCHOOL", { memberOnly: true });

router.get("/me", teacherSelf, TeacherController.getMyProfile);

router.get(
  "/me/assignments",
  teacherSelf,
  validateRequest({ query: TeacherValidation.yearQuery }),
  TeacherController.getMyAssignments,
);

router.get(
  "/me/schedule",
  teacherSelf,
  validateRequest({ query: TeacherValidation.scheduleQuery }),
  TeacherController.getMySchedule,
);

// --------------------------------------------------------------- management

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("teacher:create"),
  validateRequest({ body: TeacherValidation.createTeacher }),
  TeacherController.createTeacher,
);

router.get(
  "/",
  authorize("teacher:view"),
  validateRequest({ query: TeacherValidation.listTeachersQuery }),
  TeacherController.getTeachers,
);

router.get(
  "/:teacherId",
  authorize("teacher:view"),
  validateRequest({ params: TeacherValidation.teacherIdParams, query: TeacherValidation.yearQuery }),
  TeacherController.getTeacherById,
);

router.patch(
  "/:teacherId",
  authorize("teacher:update"),
  validateRequest({ params: TeacherValidation.teacherIdParams, body: TeacherValidation.updateTeacher }),
  TeacherController.updateTeacher,
);

router.post(
  "/:teacherId/deactivate",
  authorize("teacher:deactivate"),
  validateRequest({ params: TeacherValidation.teacherIdParams, body: TeacherValidation.deactivateTeacher }),
  TeacherController.deactivateTeacher,
);

router.post(
  "/:teacherId/reset-password",
  authorize("teacher:reset_password"),
  validateRequest({ params: TeacherValidation.teacherIdParams }),
  TeacherController.resetPassword,
);

export const teacherRoutes = router;
