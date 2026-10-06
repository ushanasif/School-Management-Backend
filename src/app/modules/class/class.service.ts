import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isUniqueViolation } from "../../utils/prismaError";
import { CreateClassPayload } from "./class.type";
import httpStatus from 'http-status'

export const DEFAULT_SECTION_NAME = "Default";

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

    try {
        return await prisma.$transaction(async (tx) => {
            const schoolClass = await tx.schoolClass.create({
                data: {
                    schoolId,
                    name,
                    numericLevel 
                }
            });

            // Every class needs a section, because enrollments, roll numbers, the class teacher
            // and the class hours all belong to a section. It makes way for real sections later.
            const defaultSection = await tx.section.create({
                data: { schoolId, classId: schoolClass.id, name: DEFAULT_SECTION_NAME, isDefault: true },
                select: { id: true, name: true, isDefault: true },
            });

            return { ...schoolClass, defaultSection };
        });
    } catch (e) {
        if (isUniqueViolation(e)) throw new AppError("Class name already exists!", httpStatus.CONFLICT);
        throw e;
    }
};

export const ClassService = {createClass};
