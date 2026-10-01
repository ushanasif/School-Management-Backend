import express from 'express'

import validateRequest from '../../errorHandler/validateRequest';
import { ClassValidation } from './class.validation';
import { ClassController } from './class.controller';

const router = express.Router();

router.post('/create', validateRequest({body: ClassValidation.createClass}), ClassController.createClass);

export const classRoutes = router;