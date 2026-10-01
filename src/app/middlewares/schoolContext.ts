import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../errorHandler/AppError";

import httpStatus from "http-status";


const schoolContext = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    let schoolId: string | undefined;

    if (req.auth?.sessionType === "SCHOOL") {
      schoolId = req.auth.schoolId;
    }

    if (req.auth?.sessionType === "PLATFORM") {
      const paramSchoolId = req.params.schoolId;

      if(typeof paramSchoolId === 'string'){
        schoolId = paramSchoolId
      }
    }

    if (!schoolId) {
      throw new AppError(
        "School context could not be determined",
        httpStatus.BAD_REQUEST
      );
    }

    req.schoolId = schoolId;

    next();
  } catch (error) {
    next(error);
  }
};

export default schoolContext;