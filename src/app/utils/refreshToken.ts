import crypto from "crypto";
import config from "../config";

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

const hashRefreshToken = (
  token: string,
) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

const generateFamilyId = () => {
  return crypto.randomUUID();
};


export const RefreshTokenUtils = {
  generateRefreshToken,
  hashRefreshToken,
  generateFamilyId
};