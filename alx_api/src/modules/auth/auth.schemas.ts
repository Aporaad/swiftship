import { z } from 'zod';

export const loginInputSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(1_024),
  })
  .strict();

export const refreshInputSchema = z
  .object({
    refreshToken: z.string().min(32).max(512),
  })
  .strict();

export const logoutInputSchema = z
  .object({
    refreshToken: z.string().min(32).max(512),
  })
  .strict();

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(1_024),
    newPassword: z.string().min(12).max(128),
  })
  .strict();

export const requestPasswordResetInputSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
  })
  .strict();

export const completePasswordResetInputSchema = z
  .object({
    token: z.string().min(32).max(256),
    newPassword: z.string().min(12).max(128),
  })
  .strict();

export const sessionIdParamSchema = z.string().uuid();

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RefreshInput = z.infer<typeof refreshInputSchema>;
export type LogoutInput = z.infer<typeof logoutInputSchema>;
