import type { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { SectionService } from "./section.service";
import sendResponse from "../../shared/sendResponse";


export const createSection = async (req: Request, res: Response, next: NextFunction) => {
    const schoolId = 'cmucy4ozy0000pcui71jscbs0'
  
    const section = await SectionService.createSection(schoolId, req.body);
   
    sendResponse(res, {statusCode: httpStatus.CREATED, success: true, message: "Section created successfully!", data: section});
};

// export const getSections = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     const { classId } = req.query as { classId?: string };
//     const sections = await sectionService.getSections(schoolId, classId);
//     res.status(httpStatus.OK).json({ success: true, data: sections });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getSectionById = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     const section = await sectionService.getSectionById(schoolId, req.params.sectionId);
//     res.status(httpStatus.OK).json({ success: true, data: section });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     const section = await sectionService.updateSection(schoolId, req.params.sectionId, req.body);
//     res.status(httpStatus.OK).json({ success: true, data: section });
//   } catch (error) {
//     next(error);
//   }
// };

// export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     await sectionService.deleteSection(schoolId, req.params.sectionId);
//     res.status(httpStatus.OK).json({ success: true, message: "Section deleted" });
//   } catch (error) {
//     next(error);
//   }
// };

// export const setSectionYearConfig = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     const config = await sectionService.setSectionYearConfig(schoolId, req.params.sectionId, req.body);
//     res.status(httpStatus.OK).json({ success: true, data: config });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getSectionYearConfig = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const schoolId = req.auth!.schoolId!;
//     const { academicYearId } = req.query as { academicYearId: string };
//     const config = await sectionService.getSectionYearConfig(schoolId, req.params.sectionId, academicYearId);
//     res.status(httpStatus.OK).json({ success: true, data: config });
//   } catch (error) {
//     next(error);
//   }
// };

export const SectionController = {createSection}