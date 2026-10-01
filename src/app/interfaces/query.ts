export type SortOrder = "asc" | "desc";

export type PaginationQuery = {
  page?: number;
  limit?: number;
};

export type SortQuery<
  TSortField extends string = string
> = {
  sortBy?: TSortField;
  sortOrder?: SortOrder;
};

export type SearchQuery = {
  search?: string;
};

export type BaseQuery<
  TSortField extends string = string
> =
  PaginationQuery &
  SortQuery<TSortField> &
  SearchQuery;