import type { z } from "zod";
import { ScheduleValidation } from "./schedule.validation";

export type OverridePayload = z.infer<typeof ScheduleValidation.overrideBody>;
export type ListOverridesQuery = z.infer<typeof ScheduleValidation.listOverridesQuery>;
export type HoursQuery = z.infer<typeof ScheduleValidation.hoursQuery>;
