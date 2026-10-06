import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { SubjectService } from "./subject.service";
import type { ListSubjectsQuery } from "./subject.type";

/*
 * The same handlers serve two routers: school routes work on the school's own subjects
 * (owner = its id), platform routes on the shared NCTB list (owner = null).
 */
type OwnerOf = (req: Request) => string | null;

const schoolOwner: OwnerOf = (req) => req.auth!.schoolId!;
const platformOwner: OwnerOf = () => null;

const handlers = (ownerOf: OwnerOf) => ({
  createSubject: catchAsync(async (req: Request, res: Response) => {
    const result = await SubjectService.createSubject(ownerOf(req), req.body);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Subject created successfully!",
      data: result,
    });
  }),

  getSubjects: catchAsync(async (req: Request, res: Response) => {
    const result = await SubjectService.getSubjects(ownerOf(req), req.query as unknown as ListSubjectsQuery);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subjects retrieved successfully!",
      data: result,
    });
  }),

  getSubjectById: catchAsync(async (req: Request, res: Response) => {
    const result = await SubjectService.getSubjectById(ownerOf(req), req.params.subjectId as string);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subject retrieved successfully!",
      data: result,
    });
  }),

  updateSubject: catchAsync(async (req: Request, res: Response) => {
    const result = await SubjectService.updateSubject(ownerOf(req), req.params.subjectId as string, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subject updated successfully!",
      data: result,
    });
  }),

  deleteSubject: catchAsync(async (req: Request, res: Response) => {
    await SubjectService.deleteSubject(ownerOf(req), req.params.subjectId as string);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subject deleted successfully!",
      data: null,
    });
  }),
});

export const SubjectController = handlers(schoolOwner);
export const PlatformSubjectController = handlers(platformOwner);
