import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { CreateClassPayload } from "./class.type";
import httpStatus from 'http-status'

const createClass = async(schoolId: string, payload: CreateClassPayload) => {
    const {name, numericLevel} = payload;

    const isClassNameExist = await prisma.schoolClass.findUnique({
        where: {
            schoolId_name: {
                schoolId,
                name
            }
        }
    });

    if(isClassNameExist){
        throw new AppError("Class name already exists!", httpStatus.CONFLICT)
    }

    const className = await prisma.schoolClass.create({
        data: {
            schoolId,
            name,
            numericLevel
        }
    })
};

export const ClassService = {createClass};