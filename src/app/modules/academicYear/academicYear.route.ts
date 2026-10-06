import express from 'express'
import { AcademicYearController } from './academicYear.controller';
import { AcademicYearValidation } from './academicYear.validation';
import validateRequest from '../../errorHandler/validateRequest';
import authenticate from '../../middlewares/auth';
import authorize from '../../middlewares/authorize';

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
    '/create',
    authorize("academic_year:create"),
    validateRequest({body: AcademicYearValidation.createAcademicYear}),
    AcademicYearController.createAcademicYear,
);

export const academicYearRoute = router;
