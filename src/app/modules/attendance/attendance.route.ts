import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { AttendanceController } from "./attendance.controller";
import { AttendanceValidation } from "./attendance.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// ------------------------------------------------------- student roll call

router.get(
  "/students/sheet",
  authorize("attendance:mark"),
  validateRequest({ query: AttendanceValidation.studentSheetQuery }),
  AttendanceController.getStudentSheet,
);

// up to 7 days back; older days also need attendance:edit_past (checked in the service)
router.put(
  "/students/sheet",
  authorize("attendance:mark"),
  validateRequest({ body: AttendanceValidation.saveStudentSheet }),
  AttendanceController.saveStudentSheet,
);

// ------------------------------------------------------------- reports

router.get(
  "/summary",
  authorize("attendance:view"),
  validateRequest({ query: AttendanceValidation.dayQuery }),
  AttendanceController.getDaySummary,
);

router.get(
  "/students/absent",
  authorize("attendance:view"),
  validateRequest({ query: AttendanceValidation.dayQuery }),
  AttendanceController.getAbsentees,
);

router.get(
  "/students/:studentId",
  authorize("attendance:view"),
  validateRequest({ params: AttendanceValidation.studentIdParams, query: AttendanceValidation.rangeQuery }),
  AttendanceController.getStudentReport,
);

router.get(
  "/sections/:sectionId/register",
  authorize("attendance:view"),
  validateRequest({ params: AttendanceValidation.sectionIdParams, query: AttendanceValidation.registerQuery }),
  AttendanceController.getSectionRegister,
);

// ------------------------------------------------------------- teachers

router.get(
  "/teachers/sheet",
  authorize("teacher_attendance:mark"),
  validateRequest({ query: AttendanceValidation.teacherSheetQuery }),
  AttendanceController.getTeacherSheet,
);

router.put(
  "/teachers/sheet",
  authorize("teacher_attendance:mark"),
  validateRequest({ body: AttendanceValidation.saveTeacherSheet }),
  AttendanceController.saveTeacherSheet,
);

router.get(
  "/teachers/:teacherId",
  authorize("teacher_attendance:view"),
  validateRequest({ params: AttendanceValidation.teacherIdParams, query: AttendanceValidation.rangeQuery }),
  AttendanceController.getTeacherReport,
);

export const attendanceRoutes = router;
