import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { FeeStructureController } from "./feeStructure.controller";
import { FeeStructureValidation } from "./feeStructure.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("fee_structure:create"),
  validateRequest({ body: FeeStructureValidation.createFeeStructure }),
  FeeStructureController.createFeeStructure,
);

router.get(
  "/",
  authorize("fee_structure:view"),
  validateRequest({ query: FeeStructureValidation.listFeeStructuresQuery }),
  FeeStructureController.getFeeStructures,
);

router.post(
  "/:feeStructureId/sync",
  authorize("fee_structure:update"),
  validateRequest({ params: FeeStructureValidation.feeStructureIdParams }),
  FeeStructureController.syncFeeStructure,
);

export const feeStructureRoutes = router;