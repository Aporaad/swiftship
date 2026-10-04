import { z } from 'zod';
export const customerIdSchema = z.string().trim().min(1).max(128);
export const listCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
