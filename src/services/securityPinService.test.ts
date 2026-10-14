import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestPinVerification: vi.fn() }));

vi.mock('../data/http/security-pin.api', () => ({
  requestPinVerification: mocks.requestPinVerification,
}));

import { pinVerificationMessage, verifyCurrentUserPin } from './securityPinService';

const apiError = (code: string, message = 'فشل') => Object.assign(new Error(message), { code });

describe('التحقق الخادمي من رمز PIN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يقبل الرمز الصحيح ويرفض الخاطئ من استجابة الخادم فقط', async () => {
    mocks.requestPinVerification.mockResolvedValue({ configured: true, valid: true });
    await expect(verifyCurrentUserPin('  4321  ')).resolves.toEqual({ status: 'valid' });
    expect(mocks.requestPinVerification).toHaveBeenCalledWith('4321');

    mocks.requestPinVerification.mockResolvedValue({ configured: true, valid: false });
    await expect(verifyCurrentUserPin('9876')).resolves.toEqual({ status: 'invalid' });
  });

  it('لا يعتبر الرمز الفارغ صحيحًا ولا ينادي الخادم أصلًا', async () => {
    await expect(verifyCurrentUserPin('   ')).resolves.toEqual({ status: 'invalid' });
    expect(mocks.requestPinVerification).not.toHaveBeenCalled();
  });

  it('يفرّق بين الرمز الخاطئ وحساب بلا رمز مضبوط', async () => {
    mocks.requestPinVerification.mockResolvedValue({ configured: false, valid: false });
    await expect(verifyCurrentUserPin('7777')).resolves.toEqual({ status: 'not-configured' });
    expect(pinVerificationMessage({ status: 'not-configured' }, true)).toContain('لا يوجد رمز PIN مضبوط');
  });

  it('يعالج انتهاء الجلسة وفشل الشبكة دون قبول الرمز', async () => {
    mocks.requestPinVerification.mockRejectedValue(apiError('AUTH_INVALID_CREDENTIALS'));
    await expect(verifyCurrentUserPin('5555')).resolves.toEqual({ status: 'unauthenticated' });

    mocks.requestPinVerification.mockRejectedValue(apiError('ENTITY_NOT_FOUND'));
    await expect(verifyCurrentUserPin('5555')).resolves.toEqual({ status: 'not-configured' });

    mocks.requestPinVerification.mockRejectedValue(new Error('timeout'));
    await expect(verifyCurrentUserPin('5555')).resolves.toEqual({ status: 'unavailable', message: 'timeout' });
  });

  it('يعيد رسالة عربية وإنجليزية لكل حالة ولا يمرر قيمة الرمز إليها', async () => {
    expect(pinVerificationMessage({ status: 'invalid' }, true)).toContain('غير صحيح');
    expect(pinVerificationMessage({ status: 'invalid' }, false)).toContain('Invalid PIN');
    expect(pinVerificationMessage({ status: 'unauthenticated' }, true)).toContain('انتهت الجلسة');
    expect(pinVerificationMessage({ status: 'unavailable', message: 'API request failed with status 500.' }, false))
      .toContain('PIN verification failed');
  });
});
