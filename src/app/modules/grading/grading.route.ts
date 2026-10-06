import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { GradingController } from "./grading.controller";
import { GradingValidation } from "./grading.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

// ------------------------------------------------------------ grading scales

router.post(
  "/scales",
  authorize("grading:manage"),
  validateRequest({ body: GradingValidation.scaleBody }),
  GradingController.createScale,
);

router.get("/scales", authorize("grading:view"), GradingController.getScales);

router.get(
  "/scales/:scaleId",
  authorize("grading:view"),
  validateRequest({ params: GradingValidation.scaleIdParams }),
  GradingController.getScaleById,
);

router.put(
  "/scales/:scaleId",
  authorize("grading:manage"),
  validateRequest({ params: GradingValidation.scaleIdParams, body: GradingValidation.scaleBody }),
  GradingController.updateScale,
);

// how a locked scale is changed: copy it, edit the copy
router.post(
  "/scales/:scaleId/copy",
  authorize("grading:manage"),
  validateRequest({ params: GradingValidation.scaleIdParams, body: GradingValidation.copyScale }),
  GradingController.copyScale,
);

router.delete(
  "/scales/:scaleId",
  authorize("grading:manage"),
  validateRequest({ params: GradingValidation.scaleIdParams }),
  GradingController.deleteScale,
);

// ------------------------------------------------------ class result settings

router.get(
  "/class-settings",
  authorize("grading:view"),
  validateRequest({ query: GradingValidation.classSettingsQuery }),
  GradingController.getClassSettings,
);

router.put(
  "/class-settings",
  authorize("grading:manage"),
  validateRequest({ body: GradingValidation.setClassSetting }),
  GradingController.setClassSetting,
);

export const gradingRoutes = router;
