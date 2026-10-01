import express from "express";
import validateRequest from "../../errorHandler/validateRequest";
import authenticate from "../../middlewares/auth";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = express.Router();

// Platform
router.post(
  "/platform/login",
  validateRequest({ body: AuthValidation.platformLoginSchema }),
  AuthController.platformLogin,
);
router.post("/platform/refresh", AuthController.refreshPlatformAccessToken);
router.post("/platform/logout", AuthController.platformLogout);

// School
router.post(
  "/school/login",
  validateRequest({ body: AuthValidation.schoolLoginSchema }),
  AuthController.schoolLogin,
);
router.post("/school/refresh", AuthController.refreshSchoolAccessToken);
router.post("/school/logout", AuthController.schoolLogout);

// Any logged-in session. These also work while a generated password is still
// waiting to be changed; every other protected route is blocked until it is.
const anySession = authenticate(undefined, { allowPasswordChange: true });

router.get("/me", anySession, AuthController.getMe);
router.post(
  "/change-password",
  anySession,
  validateRequest({ body: AuthValidation.changePasswordSchema }),
  AuthController.changePassword,
);
router.post("/logout-all", anySession, AuthController.logoutAllSessions);

export const authRoutes = router;