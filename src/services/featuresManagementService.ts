/**
 * featuresManagementService.ts
 * بوابة النظام الأساسي لإدارة الميزات (المسابقات/الجوائز/الكوبونات) — API-only عبر alx_api (P10).
 * Core-system features-management gateway (contests / prizes / coupons) — API-only through alx_api (P10).
 *
 * المبدأ الحاكم: الواجهة تجمع المدخلات وتعرض النتائج فقط؛ لا تقرر الأهلية ولا تحسب الخصم
 * ولا تلمس قاعدة البيانات. كل حقل يصل مسطّحًا بcamelCase من العقد، ولا تُقرأ أي حمولة jsonb.
 * Governing principle: the UI collects input and renders results only; it never decides
 * eligibility, never computes a discount, and never touches the database. Every field arrives
 * as a flat camelCase contract property and no jsonb payload is read.
 */
import { appApiClient, type ApiEnvelope } from "../data/http/app-api-client";
import type { GatewayQuery } from "../data/contracts/common.gateway";

const CONTESTS_PATH = "/api/v1/features/contests";
const PRIZES_PATH = "/api/v1/features/prizes";
const COUPONS_PATH = "/api/v1/features/coupons";
const DRAW_RUNS_PATH = "/api/v1/features/draw-runs";
const WINNER_AWARDS_PATH = "/api/v1/features/winner-awards";
const REPORTS_PATH = "/api/v1/features/reports";
const PAGE_SIZE = 100;
const MAX_ROWS = 10_000;

/** استعلام القائمة الموسّع — يضيف مرشّح الحالة الذي تدعمه مسارات الميزات. */
/** Extended list query — adds the status filter the feature routes support. */
export interface FeaturesQuery extends GatewayQuery {
  status?: string;
}

// ── أنواع صفوف العرض (عقد مسطّح) — flat row view types ─────────────────────────
export interface FeatureContestRow {
  contestId: string;
  title: string;
  description: string;
  status: string;
  startsAt: number;
  endsAt: number;
  termsVersion: string;
  claimDays: number;
}

export interface FeaturePrizeRow {
  prizeId: string;
  name: string;
  prizeType: string;
  description: string;
  quantityTotal: number;
  quantityReserved: number;
  status: string;
  valueAmount: number;
  valueCurrencyCode: string;
}

export interface FeatureCouponRow {
  couponId: string;
  code: string;
  discountType: string;
  amount: number;
  currencyCode: string;
  percent: number;
  minimumProductsSubtotal: number;
  maxDiscount: number;
  startsAt: number;
  endsAt: number;
  totalLimit: number | null;
  perCustomerLimit: number;
  usageCount: number;
  status: string;
}

export interface FeatureContestEntryRow {
  entryId: string;
  contestId: string;
  customerId: string;
  status: string;
  termsVersion: string;
  reviewReason: string;
  createdAt: number;
}

// صفوف تفاصيل المسابقة (إداري) — §10.1 admin contest detail rows
/** Admin contest-detail prize row (allocation link view). */
export interface FeatureContestPrizeRow {
  contestPrizeId: string;
  prizeId: string;
  name: string;
  prizeType: string;
  quantityAllocated: number;
  quantityAwarded: number;
  sortOrder: number;
}

/** Contest detail bundle returned by GET /features/contests/:id. */
export interface FeatureContestDetail {
  contest: FeatureContestRow;
  prizes: FeatureContestPrizeRow[];
}

// صفوف السحب والجوائز — draw runs & winner awards (§10.1 / §11.1)
/** Draw-run summary as returned by freeze/execute/approve endpoints. */
export interface FeatureDrawRunRow {
  drawRunId: string;
  contestId: string;
  status: string;
  method: string;
  eligibleCount: number;
  snapshotHash: string;
  executedBy: string;
  approvedBy: string;
}

/** Winner-award row returned by assignWinners/fulfillAward. */
export interface FeatureWinnerAwardRow {
  awardId: string;
  contestId: string;
  entryId: string;
  contestPrizeId: string;
  status: string;
  claimDeadline: number;
}

/** Reports summary counters (GET /features/reports/summary). */
export interface FeaturesReportsSummary {
  contestsTotal: number;
  contestsActive: number;
  entriesEligible: number;
  entriesWinners: number;
  awardsDelivered: number;
  awardsOpen: number;
  couponsActive: number;
  issuancesIssued: number;
  redemptionsRedeemed: number;
}

// ── مُدخلات النماذج (تُرسَل كما هي؛ الخادم يعيد التحقق) — form inputs (server revalidates) ──
export interface CreateContestInput {
  title: string;
  description?: string;
  termsText: string;
  termsVersion: string;
  startsAt: string;
  endsAt: string;
  claimDays: number;
}

export interface CreatePrizeInput {
  name: string;
  prizeType: "physical" | "digital" | "coupon";
  description?: string;
  quantityTotal: number;
  valueAmount?: number;
  valueCurrencyCode?: string;
}

export interface CreateCouponInput {
  code: string;
  discountType: "fixed" | "percent";
  amount?: number;
  currencyCode?: string;
  percent?: number;
  minimumProductsSubtotal?: number;
  maxDiscount?: number;
  startsAt: string;
  endsAt: string;
  totalLimit?: number;
  perCustomerLimit: number;
}

// ── أدوات تطبيع آمنة (لا تُختلق قيم) — safe normalizers (nothing is invented) ──
const text = (value: unknown): string =>
  typeof value === "string" ? value : String(value ?? "");
const number = (value: unknown): number => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const timestamp = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const rowsOf = (payload: unknown): Record<string, unknown>[] => {
  let list: unknown[] = [];
  if (Array.isArray(payload)) list = payload;
  else if (Array.isArray(record(payload).items))
    list = record(payload).items as unknown[];
  return list.map(row => record(row));
};

const mapContest = (row: Record<string, unknown>): FeatureContestRow => ({
  contestId: text(row.contestId),
  title: text(row.title),
  description: text(row.description),
  status: text(row.status) || "draft",
  startsAt: timestamp(row.startsAt),
  endsAt: timestamp(row.endsAt),
  termsVersion: text(row.termsVersion),
  claimDays: number(row.claimDays),
});

const mapPrize = (row: Record<string, unknown>): FeaturePrizeRow => ({
  prizeId: text(row.prizeId),
  name: text(row.name),
  prizeType: text(row.prizeType),
  description: text(row.description),
  quantityTotal: number(row.quantityTotal),
  quantityReserved: number(row.quantityReserved),
  status: text(row.status) || "active",
  valueAmount: number(row.valueAmount),
  valueCurrencyCode: text(row.valueCurrencyCode),
});

const mapCoupon = (row: Record<string, unknown>): FeatureCouponRow => ({
  couponId: text(row.couponId),
  code: text(row.code),
  discountType: text(row.discountType),
  amount: number(row.amount),
  currencyCode: text(row.currencyCode),
  percent: number(row.percent),
  minimumProductsSubtotal: number(row.minimumProductsSubtotal),
  maxDiscount: number(row.maxDiscount),
  startsAt: timestamp(row.startsAt),
  endsAt: timestamp(row.endsAt),
  totalLimit:
    row.totalLimit === null || row.totalLimit === undefined
      ? null
      : number(row.totalLimit),
  perCustomerLimit: number(row.perCustomerLimit),
  usageCount: number(row.usageCount),
  status: text(row.status) || "draft",
});

const mapEntry = (row: Record<string, unknown>): FeatureContestEntryRow => ({
  entryId: text(row.entryId),
  contestId: text(row.contestId),
  customerId: text(row.customerId),
  status: text(row.status),
  termsVersion: text(row.termsVersion),
  reviewReason: text(row.reviewReason),
  createdAt: timestamp(row.createdAt),
});

const mapContestPrize = (
  row: Record<string, unknown>
): FeatureContestPrizeRow => ({
  contestPrizeId: text(row.contestPrizeId),
  prizeId: text(row.prizeId),
  name: text(row.name),
  prizeType: text(row.prizeType),
  quantityAllocated: number(row.quantityAllocated),
  quantityAwarded: number(row.quantityAwarded),
  sortOrder: number(row.sortOrder),
});

const mapDrawRun = (row: Record<string, unknown>): FeatureDrawRunRow => ({
  drawRunId: text(row.drawRunId),
  contestId: text(row.contestId),
  status: text(row.status),
  method: text(row.method),
  eligibleCount: number(row.eligibleCount),
  snapshotHash: text(row.snapshotHash),
  executedBy: text(row.executedBy),
  approvedBy: text(row.approvedBy),
});

const mapWinnerAward = (
  row: Record<string, unknown>
): FeatureWinnerAwardRow => ({
  awardId: text(row.awardId),
  contestId: text(row.contestId),
  entryId: text(row.entryId),
  contestPrizeId: text(row.contestPrizeId),
  status: text(row.status),
  claimDeadline: timestamp(row.claimDeadline),
});

/** يفكّ غلاف الاستجابة ويرمي خطأ موحّد عند فشل العقد. */
/** Unwraps the envelope and throws the raw contract error on failure. */
function unwrap<T>(response: ApiEnvelope<T> | undefined): T {
  if (!response || response.success !== true)
    throw response ?? new Error("FEATURES_REQUEST_FAILED");
  return response.data;
}

/** قراءة كل الصفحات ضمن حدّ حمايةً من الحلقات غير المنتهية (نفس نمط خدمات النظام). */
/** Reads every page within a cap to avoid unbounded loops (same pattern as the other system services). */
async function listAll<T>(
  path: string,
  map: (row: Record<string, unknown>) => T,
  query: FeaturesQuery = {}
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const res = await appApiClient.get<ApiEnvelope<unknown>>(path, {
      ...query,
      limit: PAGE_SIZE,
      offset,
    });
    const rows = rowsOf(unwrap(res));
    out.push(...rows.map(map));
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

export const featuresManagementService = {
  // ── المسابقات / Contests ──────────────────────────────────────────────────
  listContests: (query?: FeaturesQuery) =>
    listAll(CONTESTS_PATH, mapContest, query),

  createContest: async (
    input: CreateContestInput
  ): Promise<FeatureContestRow> => {
    const res = await appApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      CONTESTS_PATH,
      input
    );
    return mapContest(unwrap(res));
  },

  transitionContest: async (
    contestId: string,
    action: string,
    reason?: string
  ): Promise<FeatureContestRow> => {
    const res = await appApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      `${CONTESTS_PATH}/${encodeURIComponent(contestId)}/transitions`,
      { action, ...(reason ? { reason } : {}) }
    );
    return mapContest(unwrap(res));
  },

  listContestEntries: (contestId: string, query?: FeaturesQuery) =>
    listAll(
      `${CONTESTS_PATH}/${encodeURIComponent(contestId)}/entries`,
      mapEntry,
      query
    ),

  reviewContestEntry: (
    entryId: string,
    input: { status: string; reason: string }
  ): Promise<unknown> =>
    appApiClient
      .post<ApiEnvelope<unknown>>(
        `${CONTESTS_PATH}/entries/${encodeURIComponent(entryId)}/review`,
        input
      )
      .then(unwrap),

  freezeEligibility: (
    contestId: string,
    idempotencyKey: string,
    reason?: string
  ): Promise<FeatureDrawRunRow> =>
    appApiClient
      .post<ApiEnvelope<Record<string, unknown>>>(
        `${CONTESTS_PATH}/${encodeURIComponent(contestId)}/eligibility-snapshots`,
        {
          idempotencyKey,
          ...(reason ? { reason } : {}),
        }
      )
      .then(res => mapDrawRun(record(unwrap(res)))),

  // ── تفاصيل المسابقة والسحب والفائزين — §10.1 contest detail / draw / winners ──
  /** تفاصيل مسابقة إدارية: المسابقة + مخصصات الجوائز (لا تقرأ الواجهة jsonb). */
  /** Admin contest detail: contest + prize allocations (UI never reads jsonb). */
  getContestDetail: (contestId: string): Promise<FeatureContestDetail> =>
    appApiClient
      .get<ApiEnvelope<Record<string, unknown>>>(
        `${CONTESTS_PATH}/${encodeURIComponent(contestId)}`
      )
      .then(res => {
        const payload = record(unwrap(res));
        return {
          contest: mapContest(record(payload.contest)),
          prizes: rowsOf(payload.prizes).map(mapContestPrize),
        };
      }),

  /** تعيين الفائزين يدويًا ضمن عملية سحب جاهزة (idempotency إلزامي). */
  /** Manually assign winners inside a ready draw-run (idempotency key required). */
  assignWinners: (
    drawRunId: string,
    input: {
      idempotencyKey: string;
      winners: { contestPrizeId: string; entryId: string }[];
    }
  ): Promise<{
    awards: FeatureWinnerAwardRow[];
    drawRun: FeatureDrawRunRow | null;
  }> =>
    appApiClient
      .post<ApiEnvelope<Record<string, unknown>>>(
        `${DRAW_RUNS_PATH}/${encodeURIComponent(drawRunId)}/winners`,
        input
      )
      .then(res => {
        const payload = record(unwrap(res));
        return {
          awards: rowsOf(payload.awards).map(mapWinnerAward),
          drawRun: payload.drawRun ? mapDrawRun(record(payload.drawRun)) : null,
        };
      }),

  /** اعتماد نتيجة السحب — يجب أن يكون المعتمد مختلفًا عن المنفّذ (فصل المهام). */
  /** Approve the draw result — approver must differ from the executor (separation of duties). */
  approveDrawRun: (drawRunId: string): Promise<FeatureDrawRunRow> =>
    appApiClient
      .post<ApiEnvelope<Record<string, unknown>>>(
        `${DRAW_RUNS_PATH}/${encodeURIComponent(drawRunId)}/approve`,
        {}
      )
      .then(res => mapDrawRun(record(unwrap(res)))),

  /** تحديث حالة تسليم الجائزة (notify/fulfill/ship/deliver/expire/reject). */
  /** Update award fulfillment status (notify/fulfill/ship/deliver/expire/reject). */
  fulfillAward: (
    awardId: string,
    input: {
      action: "notify" | "fulfill" | "ship" | "deliver" | "expire" | "reject";
      deliveryReference?: string;
      reason?: string;
    }
  ): Promise<FeatureWinnerAwardRow> =>
    appApiClient
      .post<ApiEnvelope<Record<string, unknown>>>(
        `${WINNER_AWARDS_PATH}/${encodeURIComponent(awardId)}/fulfillment`,
        input
      )
      .then(res => mapWinnerAward(record(unwrap(res)))),

  /** ملخص تقارير الميزات (عدّادات فقط؛ لا منطق داخل الواجهة). */
  /** Features reports summary (counters only; no logic in the UI). */
  reportsSummary: (): Promise<FeaturesReportsSummary> =>
    appApiClient
      .get<ApiEnvelope<Record<string, unknown>>>(`${REPORTS_PATH}/summary`)
      .then(res => {
        const row = record(unwrap(res));
        return {
          contestsTotal: number(row.contestsTotal),
          contestsActive: number(row.contestsActive),
          entriesEligible: number(row.entriesEligible),
          entriesWinners: number(row.entriesWinners),
          awardsDelivered: number(row.awardsDelivered),
          awardsOpen: number(row.awardsOpen),
          couponsActive: number(row.couponsActive),
          issuancesIssued: number(row.issuancesIssued),
          redemptionsRedeemed: number(row.redemptionsRedeemed),
        };
      }),

  // ── الجوائز / Prizes ──────────────────────────────────────────────────────
  listPrizes: (query?: FeaturesQuery) => listAll(PRIZES_PATH, mapPrize, query),

  createPrize: async (input: CreatePrizeInput): Promise<FeaturePrizeRow> => {
    const res = await appApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      PRIZES_PATH,
      input
    );
    return mapPrize(unwrap(res));
  },

  allocatePrize: (
    contestId: string,
    input: { prizeId: string; quantityAllocated: number }
  ): Promise<unknown> =>
    appApiClient
      .post<ApiEnvelope<unknown>>(
        `${CONTESTS_PATH}/${encodeURIComponent(contestId)}/prizes`,
        input
      )
      .then(unwrap),

  // ── الكوبونات / Coupons ───────────────────────────────────────────────────
  listCoupons: (query?: FeaturesQuery) =>
    listAll(COUPONS_PATH, mapCoupon, query),

  createCoupon: async (input: CreateCouponInput): Promise<FeatureCouponRow> => {
    const res = await appApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      COUPONS_PATH,
      input
    );
    return mapCoupon(unwrap(res));
  },

  transitionCoupon: async (
    couponId: string,
    action: string
  ): Promise<FeatureCouponRow> => {
    const res = await appApiClient.post<ApiEnvelope<Record<string, unknown>>>(
      `${COUPONS_PATH}/${encodeURIComponent(couponId)}/transitions`,
      { action }
    );
    return mapCoupon(unwrap(res));
  },

  issueCoupon: (
    couponId: string,
    input: {
      customerId?: string;
      winnerAwardId?: string;
      expiresAt?: string;
      idempotencyKey: string;
    }
  ): Promise<unknown> =>
    appApiClient
      .post<ApiEnvelope<unknown>>(
        `${COUPONS_PATH}/${encodeURIComponent(couponId)}/issuances`,
        input
      )
      .then(unwrap),

  revokeIssuance: (issuanceId: string, reason: string): Promise<unknown> =>
    appApiClient
      .post<ApiEnvelope<unknown>>(
        `/api/v1/features/coupon-issuances/${encodeURIComponent(issuanceId)}/revoke`,
        {
          reason,
        }
      )
      .then(unwrap),
};
