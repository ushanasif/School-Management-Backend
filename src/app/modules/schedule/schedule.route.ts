import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { ScheduleController } from "./schedule.controller";
import { ScheduleValidation } from "./schedule.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// the class hours of every section on one date, after Ramadan / exam day changes
router.get(
  "/hours",
  authorize("schedule:view"),
  validateRequest({ query: ScheduleValidation.hoursQuery }),
  ScheduleController.getHours,
);

// different hours for a period (Ramadan, winter) or a single day (exam day, sports day)
router.post(
  "/overrides",
  authorize("schedule:manage"),
  validateRequest({ body: ScheduleValidation.overrideBody }),
  ScheduleController.createOverride,
);

router.get(
  "/overrides",
  authorize("schedule:view"),
  validateRequest({ query: ScheduleValidation.listOverridesQuery }),
  ScheduleController.getOverrides,
);

router.get(
  "/overrides/:overrideId",
  authorize("schedule:view"),
  validateRequest({ params: ScheduleValidation.overrideIdParams }),
  ScheduleController.getOverrideById,
);

router.put(
  "/overrides/:overrideId",
  authorize("schedule:manage"),
  validateRequest({ params: ScheduleValidation.overrideIdParams, body: ScheduleValidation.overrideBody }),
  ScheduleController.updateOverride,
);

router.delete(
  "/overrides/:overrideId",
  authorize("schedule:manage"),
  validateRequest({ params: ScheduleValidation.overrideIdParams }),
  ScheduleController.deleteOverride,
);

export const scheduleRoutes = router;
