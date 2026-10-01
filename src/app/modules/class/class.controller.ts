import httpStatus from 'http-status';
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { ClassService } from "./class.service";
import sendResponse from "../../shared/sendResponse";


const createClass = catchAsync(async (req: Request, res: Response) => {
     const schoolId = 'cmucy4ozy0000pcui71jscbs0'

     const result = await ClassService.createClass(schoolId, req.body);

    sendResponse(res, {statusCode: httpStatus.CREATED, success: true, message: "Class created successfully!", data: result});
});

export const ClassController = {createClass}