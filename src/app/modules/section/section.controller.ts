import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { SectionService } from "./section.service";
import type { ListSectionsQuery, SectionQuery, YearConfigQuery } from "./section.type";

const createSection = catchAsync(async (req: Request, res: Response) => {
  const section = await SectionService.createSection(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Section created successfully!",
    data: section,
  });
});

const getSections = catchAsync(async (req: Request, res: Response) => {
  const result = await SectionService.getSections(
    req.auth!.schoolId!,
    req.query as unknown as ListSectionsQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sections retrieved successfully!",
    data: result,
  });
});

const getSectionById = catchAsync(async (req: Request, res: Response) => {
  const result = await SectionService.getSectionById(
    req.auth!.schoolId!,
    req.params.sectionId as string,
    req.query as unknown as SectionQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Section retrieved successfully!",
    data: result,
  });
});

const updateSection = catchAsync(async (req: Request, res: Response) => {
  const result = await SectionService.updateSection(
    req.auth!.schoolId!,
    req.params.sectionId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Section updated successfully!",
    data: result,
  });
});

const deleteSection = catchAsync(async (req: Request, res: Response) => {
  await SectionService.deleteSection(req.auth!.schoolId!, req.params.sectionId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Section deleted successfully!",
    data: null,
  });
});

const setYearConfig = catchAsync(async (req: Request, res: Response) => {
  const result = await SectionService.setYearConfig(
    req.auth!.schoolId!,
    req.params.sectionId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Section settings saved successfully!",
    data: result,
  });
});

const getYearConfig = catchAsync(async (req: Request, res: Response) => {
  const result = await SectionService.getYearConfig(
    req.auth!.schoolId!,
    req.params.sectionId as string,
    req.query as unknown as YearConfigQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Section settings retrieved successfully!",
    data: result,
  });
});

export const SectionController = {
  createSection,
  getSections,
  getSectionById,
  updateSection,
  deleteSection,
  setYearConfig,
  getYearConfig,
};
