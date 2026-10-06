import { z } from 'zod';

export const portalLoginInputSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
}).strict();

export const portalRefreshInputSchema = z.object({
  refreshToken: z.string().min(32).max(512),
}).strict();

export const portalChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: 'New password must differ from current password.',
  path: ['newPassword'],
});

export const portalPasswordResetInputSchema = z.object({
  newPassword: z.string().min(12).max(128),
}).strict();

export type PortalLoginInput = z.infer<typeof portalLoginInputSchema>;
export type PortalRefreshInput = z.infer<typeof portalRefreshInputSchema>;
export type PortalChangePasswordInput = z.infer<typeof portalChangePasswordInputSchema>;
