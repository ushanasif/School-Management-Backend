import express from 'express'

import validateRequest from '../../errorHandler/validateRequest';
import authenticate from '../../middlewares/auth';
import authorize from '../../middlewares/authorize';
import { ClassValidation } from './class.validation';
import { ClassController } from './class.controller';

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
    '/create',
    authorize("class:create"),
    validateRequest({body: ClassValidation.createClass}),
    ClassController.createClass,
);

export const classRoutes = router;
