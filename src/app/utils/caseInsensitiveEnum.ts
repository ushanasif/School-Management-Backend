import { z } from 'zod';

 
export const caseInsensitiveEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(values),
  );