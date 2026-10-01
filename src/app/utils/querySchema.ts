import { z } from 'zod';

export const baseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type BaseQuery = z.infer<typeof baseQuerySchema>;

export const withFilters = <T extends z.ZodRawShape>(filters: T) =>
  baseQuerySchema.extend(filters);