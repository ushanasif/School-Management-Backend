import { Request, Response } from "express";
import { SchoolService } from "./school.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import { GetAllSchoolsQuery } from "./school.type";


const createSchool = catchAsync(async (req: Request, res: Response) => {
  const result = await SchoolService.createSchool(req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "School created successfully!",
    data: result,
  });
});

const activateSchool = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.schoolId as string;
     const result = await SchoolService.activateSchool(id)

    sendResponse(res, {statusCode: httpStatus.OK, success: true, message: "School is activated successfully!", data: result})
});


const getAllSchools = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as GetAllSchoolsQuery;

    const result = await SchoolService.getAllSchools(query);
    
      
    sendResponse(res, {statusCode: httpStatus.OK, success: true, message: "School is activated successfully!", data: result})
});

export const SchoolController = { createSchool, activateSchool, getAllSchools };
