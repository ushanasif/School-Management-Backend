import type { z } from "zod";
import { SectionValidation } from "./section.validation";

export type CreateSectionPayload = z.infer<typeof SectionValidation.createSectionSchema>;
export type UpdateSectionPayload = z.infer<typeof SectionValidation.updateSectionSchema>;
export type ListSectionsQuery = z.infer<typeof SectionValidation.listSectionsQuery>;
export type SectionQuery = z.infer<typeof SectionValidation.sectionQuery>;
export type YearConfigQuery = z.infer<typeof SectionValidation.yearConfigQuery>;
export type SetYearConfigPayload = z.infer<typeof SectionValidation.setYearConfigSchema>;
