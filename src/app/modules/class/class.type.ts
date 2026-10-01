import type {z} from "zod";
import { ClassValidation } from "./class.validation";


export type CreateClassPayload = z.infer<typeof ClassValidation.createClass>