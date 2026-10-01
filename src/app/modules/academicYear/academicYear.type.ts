import type {z} from 'zod'
import { AcademicYearValidation } from './academicYear.validation';

export type CreateAcademicYearPayload = z.infer<typeof AcademicYearValidation.createAcademicYear>