import express from 'express'
import validateRequest from '../../errorHandler/validateRequest';
import authenticate from '../../middlewares/auth';
import authorize from '../../middlewares/authorize';
import { SectionValidation } from './section.validation';
import { SectionController } from './section.controller';

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
    '/create',
    authorize("section:create"),
    validateRequest({body: SectionValidation.createSectionSchema}),
    SectionController.createSection,
);

router.get(
    '/',
    authorize("section:view"),
    validateRequest({query: SectionValidation.listSectionsQuery}),
    SectionController.getSections,
);

router.get(
    '/:sectionId',
    authorize("section:view"),
    validateRequest({params: SectionValidation.sectionIdParams, query: SectionValidation.sectionQuery}),
    SectionController.getSectionById,
);

router.patch(
    '/:sectionId',
    authorize("section:update"),
    validateRequest({params: SectionValidation.sectionIdParams, body: SectionValidation.updateSectionSchema}),
    SectionController.updateSection,
);

router.delete(
    '/:sectionId',
    authorize("section:delete"),
    validateRequest({params: SectionValidation.sectionIdParams}),
    SectionController.deleteSection,
);

// class teacher and capacity of a section for one academic year
router.get(
    '/:sectionId/year-config',
    authorize("section:view"),
    validateRequest({params: SectionValidation.sectionIdParams, query: SectionValidation.yearConfigQuery}),
    SectionController.getYearConfig,
);

router.put(
    '/:sectionId/year-config',
    authorize("section:configure"),
    validateRequest({params: SectionValidation.sectionIdParams, body: SectionValidation.setYearConfigSchema}),
    SectionController.setYearConfig,
);

export const sectionRoutes = router;
