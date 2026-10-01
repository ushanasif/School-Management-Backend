import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { FeeTypeController } from "./feeType.controller";
import { FeeTypeValidation } from "./feeType.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("fee_type:create"),
  validateRequest({ body: FeeTypeValidation.createFeeType }),
  FeeTypeController.createFeeType,
);

router.get(
  "/",
  authorize("fee_type:view"),
  validateRequest({ query: FeeTypeValidation.listFeeTypesQuery }),
  FeeTypeController.getFeeTypes,
);

router.patch(
  "/:feeTypeId",
  authorize("fee_type:update"),
  validateRequest({
    params: FeeTypeValidation.feeTypeIdParams,
    body: FeeTypeValidation.updateFeeType,
  }),
  FeeTypeController.updateFeeType,
);

export const feeTypeRoutes = router;