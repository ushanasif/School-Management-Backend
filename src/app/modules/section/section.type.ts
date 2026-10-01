import type {z} from "zod";
import { SectionValidation } from './section.validation';


export type CreateSectionPayload = z.infer<typeof SectionValidation.createSectionSchema>