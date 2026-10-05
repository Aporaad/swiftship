import { z } from 'zod';

const optionalText = z.string().trim().max(500).optional();

export const createUserSchema = z.object({
  userId: z.string().trim().min(1).max(128).optional(),
  username: z.string().trim().min(1).max(128),
  email: z.string().trim().email().optional(),
  fullName: optionalText,
  role: z.string().trim().min(1).max(64).optional(),
  disabled: z.boolean().optional(),
  phone: optionalText,
  address: optionalText,
  linkedType: optionalText,
  linkedEntity: optionalText,
});

export const updateUserSchema = createUserSchema.partial();

export const setUserRolesSchema = z.object({
  roles: z.array(z.string().trim().min(1).max(64)).max(50),
});

/** Provisioning accepts profile data only; credentials are created through reset delivery. */
export const provisionUserSchema = createUserSchema.extend({
  email: z.string().trim().email(),
  roleCodes: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
}).strict();

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(12).max(128),
}).strict();
