import express from 'express'
import validateRequest from '../../errorHandler/validateRequest';
import { SectionValidation } from './section.validation';
import { SectionController } from './section.controller';

const router = express.Router();

router.post('/create', validateRequest({body: SectionValidation.createSectionSchema}), SectionController.createSection);

export const sectionRoutes = router;