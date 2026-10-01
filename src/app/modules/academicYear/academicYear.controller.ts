import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { AcademicYearService } from "./academicYear.service";
import sendResponse from "../../shared/sendResponse";


const createAcademicYear = catchAsync(
  async (req: Request, res: Response) => {
    // const { schoolId } = req.auth!;
    const schoolId = 'cmucy4ozy0000pcui71jscbs0'
    
    const result = await AcademicYearService.createAcademicYear(
      schoolId!,
      req.body
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Academic year created successfully",
      data: result,
    });
  }
);

export const AcademicYearController = {
  createAcademicYear,
};