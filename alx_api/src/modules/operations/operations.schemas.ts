import { z } from 'zod';
export const entityIdSchema = z.string().trim().min(1).max(128);
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
});
