/**
 * security-pin.api.ts
 * نداء HTTP واحد للتحقق من رمز PIN في الخادم — المصدر الوحيد لهذه المكالمة في التطبيق.
 * The single HTTP call that verifies a PIN server-side; every layer reuses it (DRY).
 */
import { appApiClient, type ApiEnvelope } from './app-api-client';

/** استجابة الخادم: هل الرمز مضبوط أصلًا، وهل القيمة المُدخلة مطابقة له. */
export interface PinVerificationResult {
  configured: boolean;
  valid: boolean;
}

/**
 * يتحقق من رمز PIN الخاص بصاحب رمز الوصول الحالي — الهوية تُستخرج في الخادم ولا تُرسل من العميل.
 * Verifies the PIN of the current access-token owner; identity is derived server-side, never sent by the client.
 */
export async function requestPinVerification(pin: string): Promise<PinVerificationResult> {
  const response = await appApiClient.post<ApiEnvelope<PinVerificationResult>>('/api/v1/users/verify-pin', { pin });
  const result = response?.data;
  if (!result) throw new Error('استجابة غير صالحة من خدمة التحقق من الرمز.');
  return { configured: result.configured === true, valid: result.valid === true };
}
