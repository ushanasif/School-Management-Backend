import validateRequest from "./../../errorHandler/validateRequest";
import express from "express";
import { SchoolController } from "./school.controller";
import { SchoolValidation } from "./school.validation";
import authenticate from "../../middlewares/auth";

const router = express.Router();

// every school route is for the platform admin only
router.use(authenticate("PLATFORM"));

router.post(
  "/create",
  validateRequest({ body: SchoolValidation.createSchoolSchema }),
  SchoolController.createSchool,
);
router.patch(
  "/:schoolId/activate",
  validateRequest({ params: SchoolValidation.activateSchoolSchema }),
  SchoolController.activateSchool,
);
router.get(
  "/get_all",
  validateRequest({ query: SchoolValidation.getAllSchoolsQuerySchema }),
  SchoolController.getAllSchools,
);

export const schoolRoutes = router;
