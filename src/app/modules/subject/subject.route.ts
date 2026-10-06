import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { PlatformSubjectController, SubjectController } from "./subject.controller";
import { SubjectValidation } from "./subject.validation";

// ------------------------------------------------------------------ school
// lists the shared NCTB subjects plus the school's own; changes only its own

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("subject:create"),
  validateRequest({ body: SubjectValidation.createSubject }),
  SubjectController.createSubject,
);

router.get(
  "/",
  authorize("subject:view"),
  validateRequest({ query: SubjectValidation.listSubjectsQuery }),
  SubjectController.getSubjects,
);

router.get(
  "/:subjectId",
  authorize("subject:view"),
  validateRequest({ params: SubjectValidation.subjectIdParams }),
  SubjectController.getSubjectById,
);

router.patch(
  "/:subjectId",
  authorize("subject:update"),
  validateRequest({ params: SubjectValidation.subjectIdParams, body: SubjectValidation.updateSubject }),
  SubjectController.updateSubject,
);

router.delete(
  "/:subjectId",
  authorize("subject:delete"),
  validateRequest({ params: SubjectValidation.subjectIdParams }),
  SubjectController.deleteSubject,
);

export const subjectRoutes = router;

// ---------------------------------------------------------------- platform
// the shared NCTB list, kept by the platform admin

const platformRouter = express.Router();

platformRouter.use(authenticate("PLATFORM"));

platformRouter.post(
  "/",
  validateRequest({ body: SubjectValidation.createSubject }),
  PlatformSubjectController.createSubject,
);

platformRouter.get(
  "/",
  validateRequest({ query: SubjectValidation.listSubjectsQuery }),
  PlatformSubjectController.getSubjects,
);

platformRouter.get(
  "/:subjectId",
  validateRequest({ params: SubjectValidation.subjectIdParams }),
  PlatformSubjectController.getSubjectById,
);

platformRouter.patch(
  "/:subjectId",
  validateRequest({ params: SubjectValidation.subjectIdParams, body: SubjectValidation.updateSubject }),
  PlatformSubjectController.updateSubject,
);

platformRouter.delete(
  "/:subjectId",
  validateRequest({ params: SubjectValidation.subjectIdParams }),
  PlatformSubjectController.deleteSubject,
);

export const platformSubjectRoutes = platformRouter;
