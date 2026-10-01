import { BaseQuery } from "./querySchema";

interface BuildQueryOptions {
  /** Fields to run the free-text `search` value against (case-insensitive OR match). */
  searchableFields?: string[];

  excludeFromFilters?: string[];

  customFilterMap?: Record<string, (value: unknown) => Record<string, unknown>>;
}

const DEFAULT_EXCLUDED = ["page", "limit", "search", "sortBy", "sortOrder"];

export const buildQueryOptions = <
  Q extends BaseQuery & Record<string, unknown>,
>(
  query: Q,
  options: BuildQueryOptions = {},
) => {
  const {
    searchableFields = [],
    excludeFromFilters = [],
    customFilterMap = {},
  } = options;

  const excluded = new Set([...DEFAULT_EXCLUDED, ...excludeFromFilters]);

  /* ---------------------------- Pagination ---------------------------- */
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const take = limit;

  /* ------------------------------ Sorting ------------------------------ */
  const orderBy = query.sortBy
    ? { [query.sortBy]: query.sortOrder ?? "desc" }
    : { createdAt: query.sortOrder ?? "desc" };

  /* ------------------------------- Search ------------------------------- */
  const searchConditions =
    query.search && searchableFields.length > 0
      ? {
          OR: searchableFields.map((field) => ({
            [field]: { contains: query.search, mode: "insensitive" as const },
          })),
        }
      : {};

  /* ------------------------------- Filters ------------------------------- */
  const filterConditions: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    if (excluded.has(key) || value === undefined || value === "") continue;

    if (customFilterMap[key]) {
      Object.assign(filterConditions, { [key]: customFilterMap[key](value) });
    } else {
      filterConditions[key] = value;
    }
  }

  /* -------------------------------- Where -------------------------------- */
  const where =
    Object.keys(searchConditions).length > 0
      ? { AND: [searchConditions, filterConditions] }
      : filterConditions;

  return { where, orderBy, skip, take, page, limit };
};

/* ------------------------------------------------------------------------ */
/*  Meta / response formatter                                                */
/* ------------------------------------------------------------------------ */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const buildPaginationMeta = (
  page: number,
  limit: number,
  total: number,
): PaginationMeta => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};


export const paginate = async <T, Args extends { where?: unknown }>(
  findMany: (args: Args) => Promise<T[]>,
  count: (args: { where?: Args["where"] }) => Promise<number>,
  args: Args,
  page: number,
  limit: number,
) => {
  const [data, total] = await Promise.all([
    findMany(args),
    count({ where: args.where }),
  ]);

  return {
    data,
    meta: buildPaginationMeta(page, limit, total),
  };
};
