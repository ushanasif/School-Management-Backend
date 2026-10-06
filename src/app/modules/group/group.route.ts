import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import authorize from "../../middlewares/authorize";
import { GroupController } from "./group.controller";
import { GroupValidation } from "./group.validation";

const router = express.Router();

router.use(authenticate("SCHOOL"));

router.post(
  "/",
  authorize("group:create"),
  validateRequest({ body: GroupValidation.createGroup }),
  GroupController.createGroup,
);

router.get(
  "/",
  authorize("group:view"),
  validateRequest({ query: GroupValidation.groupQuery }),
  GroupController.getGroups,
);

router.get(
  "/:groupId",
  authorize("group:view"),
  validateRequest({ params: GroupValidation.groupIdParams, query: GroupValidation.groupQuery }),
  GroupController.getGroupById,
);

router.patch(
  "/:groupId",
  authorize("group:update"),
  validateRequest({ params: GroupValidation.groupIdParams, body: GroupValidation.updateGroup }),
  GroupController.updateGroup,
);

router.delete(
  "/:groupId",
  authorize("group:delete"),
  validateRequest({ params: GroupValidation.groupIdParams }),
  GroupController.deleteGroup,
);

export const groupRoutes = router;
