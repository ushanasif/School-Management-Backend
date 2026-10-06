import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { GroupService } from "./group.service";
import type { GroupQuery } from "./group.type";

const createGroup = catchAsync(async (req: Request, res: Response) => {
  const result = await GroupService.createGroup(req.auth!.schoolId!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Group created successfully!",
    data: result,
  });
});

const getGroups = catchAsync(async (req: Request, res: Response) => {
  const result = await GroupService.getGroups(req.auth!.schoolId!, req.query as unknown as GroupQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Groups retrieved successfully!",
    data: result,
  });
});

const getGroupById = catchAsync(async (req: Request, res: Response) => {
  const result = await GroupService.getGroupById(
    req.auth!.schoolId!,
    req.params.groupId as string,
    req.query as unknown as GroupQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group retrieved successfully!",
    data: result,
  });
});

const updateGroup = catchAsync(async (req: Request, res: Response) => {
  const result = await GroupService.updateGroup(req.auth!.schoolId!, req.params.groupId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group updated successfully!",
    data: result,
  });
});

const deleteGroup = catchAsync(async (req: Request, res: Response) => {
  await GroupService.deleteGroup(req.auth!.schoolId!, req.params.groupId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group deleted successfully!",
    data: null,
  });
});

export const GroupController = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
};
