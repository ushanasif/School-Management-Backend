import express from 'express'
import { AcademicYearController } from './academicYear.controller';
import { AcademicYearValidation } from './academicYear.validation';
import validateRequest from '../../errorHandler/validateRequest';

const router = express.Router();

router.post('/create', validateRequest({body: AcademicYearValidation.createAcademicYear}), AcademicYearController.createAcademicYear);

export const academicYearRoute = router;