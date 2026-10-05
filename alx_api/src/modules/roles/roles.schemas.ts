import { z } from 'zod';

const permissionCodes = z.array(z.string().trim().min(1).max(128)).max(200).transform((codes) => [...new Set(codes)]);
const roleCode = z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/);
export const createRoleSchema = z.object({
  code: roleCode,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  permissionCodes,
}).strict();
export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  permissionCodes: permissionCodes.optional(),
}).strict();
