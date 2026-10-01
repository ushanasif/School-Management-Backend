import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import config from "../config";

const saltRounds = Number(config.salt_round);

if (!Number.isInteger(saltRounds) || saltRounds < 10) {
  throw new Error("BCRYPT_SALT_ROUNDS must be a valid integer greater than or equal to 10");
}

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, saltRounds);
};

const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// A real hash to compare against when the user doesn't exist, so "no such user"
// and "wrong password" take the same time.
const dummyHash = bcrypt.hash("timing-equalizer-not-a-real-password", saltRounds);

const dummyCompare = async (password: string): Promise<boolean> => {
  await bcrypt.compare(password, await dummyHash);
  return false;
};

// no 0/O/1/l/I, so a password read off a printout or a phone is easy to type
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

const generateTemporaryPassword = (length = 10): string =>
  Array.from({ length }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");

export const PasswordUtils = {
  hashPassword,
  comparePassword,
  dummyCompare,
  generateTemporaryPassword,
};