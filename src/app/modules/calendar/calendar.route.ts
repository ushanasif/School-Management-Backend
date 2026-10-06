import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { CalendarController, NationalHolidayController } from "./calendar.controller";
import { CalendarValidation } from "./calendar.validation";

// ------------------------------------------------------------------ school

const router = express.Router();

router.use(authenticate("SCHOOL"));

// every day of a period: school day or not, and why
router.get(
  "/",
  authorize("holiday:view"),
  validateRequest({ query: CalendarValidation.calendarQuery }),
  CalendarController.getCalendar,
);

// weekly days off, from a date on
router.get("/weekly-holidays", authorize("holiday:view"), CalendarController.getWeeklyRules);

router.put(
  "/weekly-holidays",
  authorize("holiday:manage"),
  validateRequest({ body: CalendarValidation.setWeeklyRule }),
  CalendarController.setWeeklyRule,
);

router.delete(
  "/weekly-holidays/:ruleId",
  authorize("holiday:manage"),
  validateRequest({ params: CalendarValidation.ruleIdParams }),
  CalendarController.deleteWeeklyRule,
);

// the platform's national holidays, which the school can switch off one by one
router.get(
  "/national-holidays",
  authorize("holiday:view"),
  validateRequest({ query: CalendarValidation.nationalHolidaysQuery }),
  CalendarController.getNationalHolidays,
);

router.post(
  "/national-holidays/:nationalHolidayId/exclude",
  authorize("holiday:manage"),
  validateRequest({ params: CalendarValidation.nationalHolidayIdParams }),
  CalendarController.excludeNationalHoliday,
);

router.delete(
  "/national-holidays/:nationalHolidayId/exclude",
  authorize("holiday:manage"),
  validateRequest({ params: CalendarValidation.nationalHolidayIdParams }),
  CalendarController.restoreNationalHoliday,
);

// the school's own holidays, vacations and make-up working days
router.post(
  "/entries",
  authorize("holiday:manage"),
  validateRequest({ body: CalendarValidation.entryBody }),
  CalendarController.createEntry,
);

router.get(
  "/entries",
  authorize("holiday:view"),
  validateRequest({ query: CalendarValidation.entriesQuery }),
  CalendarController.getEntries,
);

router.get(
  "/entries/:entryId",
  authorize("holiday:view"),
  validateRequest({ params: CalendarValidation.entryIdParams }),
  CalendarController.getEntryById,
);

router.put(
  "/entries/:entryId",
  authorize("holiday:manage"),
  validateRequest({ params: CalendarValidation.entryIdParams, body: CalendarValidation.entryBody }),
  CalendarController.updateEntry,
);

router.delete(
  "/entries/:entryId",
  authorize("holiday:manage"),
  validateRequest({ params: CalendarValidation.entryIdParams }),
  CalendarController.deleteEntry,
);

export const calendarRoutes = router;

// ---------------------------------------------------------------- platform
// national holidays for every school, kept by the platform admin

const platformRouter = express.Router();

platformRouter.use(authenticate("PLATFORM"));

platformRouter.post(
  "/",
  validateRequest({ body: CalendarValidation.nationalHolidayBody }),
  NationalHolidayController.createNationalHoliday,
);

platformRouter.get(
  "/",
  validateRequest({ query: CalendarValidation.nationalHolidaysQuery }),
  NationalHolidayController.getNationalHolidays,
);

platformRouter.put(
  "/:nationalHolidayId",
  validateRequest({
    params: CalendarValidation.nationalHolidayIdParams,
    body: CalendarValidation.nationalHolidayBody,
  }),
  NationalHolidayController.updateNationalHoliday,
);

platformRouter.delete(
  "/:nationalHolidayId",
  validateRequest({ params: CalendarValidation.nationalHolidayIdParams }),
  NationalHolidayController.deleteNationalHoliday,
);

export const nationalHolidayRoutes = platformRouter;
