import crypto from "crypto";

const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateSchoolCode = (): string => {
  let code = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, CHARACTERS.length);
    code += CHARACTERS[randomIndex];
  }

  return `SCH-${code}`;
};
