import { Multer } from "multer";

declare global {
  namespace Express {
    interface Request {
        auth?: {
        userId: string;
        sessionType: "PLATFORM" | "SCHOOL";
        schoolId?: string;
        membershipId?: string;
        mustChangePassword?: boolean;
        isPlatformAdmin?: boolean;
      };
      schoolId?: string;
      file?: Express.Multer.File;
      files?:
        | Express.Multer.File[]
        | {
            [fieldname: string]: Express.Multer.File[];
          };
    }
  }
}

export {};