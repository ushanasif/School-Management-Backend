import type { z } from "zod";

import {
  SchoolValidation,
} from "./school.validation";

export type CreateSchoolPayload = {
  nameEn: string;
  nameBn: string;
  subdomain: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  monthlyFee?: string;
  discount: number;
  language?: "EN" | "BN";
  logo?: string;
  favicon?: string;
};

type ActivateSchoolParams = {
  id: string;
};


export type GetAllSchoolsQuery =
  z.infer<
    typeof SchoolValidation.getAllSchoolsQuerySchema
  >;