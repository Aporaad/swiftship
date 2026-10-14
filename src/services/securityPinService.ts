/**
 * securityPinService.ts
 * منطق الأعمال للتحقق من رمز PIN في العمليات الحساسة (الحذف النهائي).
 * Business layer for PIN verification on destructive operations — the browser never compares PIN
 * values and no hardcoded master PIN exists; the value is only ever sent to the acting user's own check.
 */
import { requestPinVerification } from '../data/http/security-pin.api';

/** نتيجة التحقق — حالة صريحة بدل قيمة منطقية حتى لا يُخلط بين «رمز خاطئ» و«لا يوجد رمز مضبوط». */
export type PinVerification =
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'not-configured' }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; message: string };

function readErrorCode(error: unknown): string {
  return (error as { code?: string } | null)?.code ?? '';
}

/**
 * يتحقق من رمز PIN الخاص بالمستخدم الحالي خادميًا.
 * Verifies the acting user's own PIN server-side; identity comes from the access token.
 */
export async function verifyCurrentUserPin(pin: string): Promise<PinVerification> {
  const trimmed = pin.trim();
  if (!trimmed) return { status: 'invalid' };

  try {
    const result = await requestPinVerification(trimmed);
    if (!result.configured) return { status: 'not-configured' };
    return result.valid ? { status: 'valid' } : { status: 'invalid' };
  } catch (error) {
    // الرمز نفسه لا يُسجَّل ولا يُعرض أبدًا — Only the failure reason surfaces, never the PIN value.
    const code = readErrorCode(error);
    if (code === 'AUTH_INVALID_CREDENTIALS') return { status: 'unauthenticated' };
    if (code === 'ENTITY_NOT_FOUND') return { status: 'not-configured' };
    return {
      status: 'unavailable',
      message: (error as { message?: string } | null)?.message || 'تعذر التحقق من الرمز.',
    };
  }
}

/** رسالة عربية/إنجليزية موحّدة لكل حالة حتى تتطابق تجربة المستخدم في كل نوافذ التأكيد. */
export function pinVerificationMessage(verification: PinVerification, isAr = true): string {
  switch (verification.status) {
    case 'not-configured':
      return isAr
        ? 'لا يوجد رمز PIN مضبوط لحسابك. اضبط الرمز من إدارة المستخدمين ثم أعد المحاولة.'
        : 'No PIN is configured for your account. Set one in user management and try again.';
    case 'unauthenticated':
      return isAr ? 'انتهت الجلسة — أعد تسجيل الدخول لتأكيد الرمز.' : 'Session expired — sign in again to confirm the PIN.';
    case 'unavailable':
      return isAr ? `تعذر التحقق من الرمز: ${verification.message}` : `PIN verification failed: ${verification.message}`;
    default:
      return isAr ? 'رمز PIN غير صحيح. تعذر إتمام العملية.' : 'Invalid PIN code. Access denied.';
  }
}
