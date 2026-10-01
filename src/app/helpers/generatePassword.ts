import crypto from "crypto"

export const generatePassword = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";

  for (let i = 0; i < 6; i++) {
    password += chars[crypto.randomInt(chars.length)];
  }

  return password;
}