import { z } from 'zod';

export const loginInputSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1_024),
}).strict();

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(32).max(512),
}).strict();

export const logoutInputSchema = z.object({
  refreshToken: z.string().min(32).max(512),
}).strict();

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RefreshInput = z.infer<typeof refreshInputSchema>;
export type LogoutInput = z.infer<typeof logoutInputSchema>;
