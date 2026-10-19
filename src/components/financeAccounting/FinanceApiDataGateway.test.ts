/**
 * FinanceApiDataGateway.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * يختبر قناتي الجلب المشتركة: مسار كل مجموعة، وتوحيد الطلبات عندما تشترك عدة شاشات في نفس المجموعة.
 * Covers the shared load channels: every collection's route, and single-flight polling when several
 * screens subscribe to the same collection.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rows = [{ assetId: 'ast_1', name: 'أصل' }, { assetId: 'ast_2', name: 'أصل ثانٍ' }];

function envelope(items: unknown[]) {
  return new Response(
    JSON.stringify({ success: true, data: items, meta: { limit: 1000, offset: 0, total: items.length } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

let requested: string[];
/** يُستورد الوحدة بعد تثبيت fetch المزيف: العميل يلتقط دالة الجلب وقت الإنشاء، لا وقت الاستدعاء.
 *  The module is imported after the stub is installed, because ApiClient captures fetch at construction. */
let gateway: typeof import('./FinanceApiDataGateway')['financeApiDataGateway'];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  requested = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
    requested.push(new URL(url).pathname);
    return envelope(rows);
  }));
  gateway = (await import('./FinanceApiDataGateway')).financeApiDataGateway;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('financeApiDataGateway', () => {
  it('serves assets, salary history and staff from their own API routes', async () => {
    const unsubs = [
      gateway.subscribeCollection('assets', () => undefined, () => undefined),
      gateway.subscribeCollection('salary_history', () => undefined, () => undefined),
      gateway.subscribeCollection('employees', () => undefined, () => undefined),
    ];
    await settle();

    expect(requested).toEqual([
      '/api/v1/finance/assets',
      '/api/v1/finance/salary-history',
      '/api/v1/reporting/employees',
    ]);
    unsubs.forEach((unsubscribe) => unsubscribe());
  });

  it('reports the id field of each row so lists and filters keep working', async () => {
    const received: Record<string, unknown>[][] = [];
    const unsubscribe = gateway.subscribeCollection(
      'assets',
      (items) => received.push(items),
      () => undefined,
    );
    await settle();

    expect(received[0]?.map((row) => row.id)).toEqual(['ast_1', 'ast_2']);
    unsubscribe();
  });

  it('polls once per collection even when several screens subscribe to it', async () => {
    const onData = () => undefined;
    const onError = () => undefined;
    const first = gateway.subscribeCollection('assets', onData, onError);
    const second = gateway.subscribeCollection('assets', onData, onError);
    await settle();
    expect(requested).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(requested).toHaveLength(2);

    first();
    second();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requested).toHaveLength(2);
  });

  it('replays the cached rows to a late subscriber instead of making it wait for the next poll', async () => {
    const first = gateway.subscribeCollection('assets', () => undefined, () => undefined);
    await settle();
    const late: Record<string, unknown>[][] = [];
    const second = gateway.subscribeCollection('assets', (items) => late.push(items), () => undefined);

    expect(late[0]?.length).toBe(rows.length);
    expect(requested).toHaveLength(1);

    first();
    second();
  });

  it('keeps the single-flight rule for one account movements shared by two screens', async () => {
    const first = gateway.subscribeAccountMovements('acc_1', () => undefined, () => undefined);
    const second = gateway.subscribeAccountMovements('acc_1', () => undefined, () => undefined);
    await settle();

    expect(requested).toEqual(['/api/v1/finance/accounts/acc_1/movements']);
    first();
    second();
  });
});
