import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { FinalResultController } from "./finalResult.controller";
import { FinalResultValidation } from "./finalResult.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

const params = FinalResultValidation.formulaIdParams;

// ---------------------------------------------------------------- formulas

router.post(
  "/",
  authorize("grading:manage"),
  validateRequest({ body: FinalResultValidation.createFormula }),
  FinalResultController.createFormula,
);

router.get(
  "/",
  authorize("exam:view_result"),
  validateRequest({ query: FinalResultValidation.listQuery }),
  FinalResultController.getFormulas,
);

router.get("/:formulaId", authorize("exam:view_result"), validateRequest({ params }), FinalResultController.getFormulaById);

router.put(
  "/:formulaId",
  authorize("grading:manage"),
  validateRequest({ params, body: FinalResultValidation.updateFormula }),
  FinalResultController.updateFormula,
);

router.delete("/:formulaId", authorize("grading:manage"), validateRequest({ params }), FinalResultController.deleteFormula);

// ---------------------------------------------------------- publish / unlock

router.post("/:formulaId/publish", authorize("exam:publish_result"), validateRequest({ params }), FinalResultController.publishFinal);

router.post("/:formulaId/unlock", authorize("exam:unlock"), validateRequest({ params }), FinalResultController.unlockFinal);

// ----------------------------------------------------------------- reports

router.get(
  "/:formulaId/tabulation",
  authorize("exam:view_result"),
  validateRequest({ params, query: FinalResultValidation.tabulationQuery }),
  FinalResultController.getTabulation,
);

router.get(
  "/:formulaId/marksheet",
  authorize("exam:view_result"),
  validateRequest({ params, query: FinalResultValidation.marksheetQuery }),
  FinalResultController.getMarksheet,
);

export const finalResultRoutes = router;
