import type { z } from "zod";
import { GroupValidation } from "./group.validation";

export type CreateGroupPayload = z.infer<typeof GroupValidation.createGroup>;
export type UpdateGroupPayload = z.infer<typeof GroupValidation.updateGroup>;
export type GroupQuery = z.infer<typeof GroupValidation.groupQuery>;
