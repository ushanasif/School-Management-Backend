import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { FundController } from "./fund.controller";
import { FundValidation } from "./fund.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("fund:create"),
  validateRequest({ body: FundValidation.createFund }),
  FundController.createFund,
);

router.get(
  "/",
  authorize("fund:view"),
  validateRequest({ query: FundValidation.listFundsQuery }),
  FundController.getFunds,
);

router.get(
  "/ledger",
  authorize("fund:ledger"),
  validateRequest({ query: FundValidation.ledgerQuery }),
  FundController.getLedger,
);

router.post(
  "/transfer",
  authorize("fund:transfer"),
  validateRequest({ body: FundValidation.transfer }),
  FundController.transfer,
);

router.get(
  "/:fundId",
  authorize("fund:view"),
  validateRequest({ params: FundValidation.fundIdParams }),
  FundController.getFundById,
);

router.patch(
  "/:fundId",
  authorize("fund:update"),
  validateRequest({ params: FundValidation.fundIdParams, body: FundValidation.updateFund }),
  FundController.updateFund,
);

router.post(
  "/:fundId/deposit",
  authorize("fund:deposit"),
  validateRequest({ params: FundValidation.fundIdParams, body: FundValidation.deposit }),
  FundController.deposit,
);

export const fundRoutes = router;