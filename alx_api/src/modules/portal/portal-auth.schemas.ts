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

export const portalRegisterInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  portalRole: z.enum(['customer', 'courier', 'supplier']),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_\u0600-\u06ff.-]+$/).optional(),
}).strict();

export const portalProfileUpdateInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().max(254).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one profile field is required.',
});

export const portalPasswordResetInputSchema = z.object({
  newPassword: z.string().min(12).max(128),
}).strict();

export type PortalLoginInput = z.infer<typeof portalLoginInputSchema>;
export type PortalRefreshInput = z.infer<typeof portalRefreshInputSchema>;
export type PortalChangePasswordInput = z.infer<typeof portalChangePasswordInputSchema>;
export type PortalRegisterInput = z.infer<typeof portalRegisterInputSchema>;
export type PortalProfileUpdateInput = z.infer<typeof portalProfileUpdateInputSchema>;
