import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  PortalCustomerDetailsDto,
  PortalCustomerDetailsUpdateInput,
  PortalOrderDto,
  PortalOrderPricingSettings,
  PortalOwnedRepository,
  PortalTicketDto,
} from './portal-owned.contracts';

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function timestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function ticketType(value: unknown): PortalTicketDto['type'] {
  return value === 'suggestion' || value === 'complaint' ? value : 'inquiry';
}

function ticketStatus(value: unknown): PortalTicketDto['status'] {
  return value === 'in_progress' || value === 'resolved' || value === 'closed' ? value : 'open';
}

function ticketRole(value: unknown): PortalTicketDto['userRole'] {
  return value === 'courier' || value === 'supplier' ? value : 'customer';
}

function toTicket(row: Record<string, unknown>): PortalTicketDto {
  const data = asRecord(row.data);
  const replies = Array.isArray(row.replies) ? row.replies : [];
  const latestAdminReply = [...replies].reverse().find((reply) => {
    const value = asRecord(reply);
    return (value.role === 'admin' || value.authorRole === 'admin')
      && (typeof value.message === 'string' || typeof value.text === 'string');
  });
  const replyData = asRecord(latestAdminReply);
  const adminResponse = typeof data.adminResponse === 'string'
    ? data.adminResponse
    : typeof replyData.message === 'string' ? replyData.message
      : typeof replyData.text === 'string' ? replyData.text : undefined;
  const respondedAt = timestamp(data.respondedAt ?? replyData.createdAt ?? replyData.timestamp);
  const createdAt = timestamp(row.createdAt ?? data.createdAt);
  return {
    id: String(row.id),
    userUid: String(row.userUid ?? ''),
    userName: String(data.userName ?? data.fullName ?? ''),
    userRole: ticketRole(data.userRole),
    type: ticketType(row.type ?? data.type),
    subject: String(row.subject ?? data.subject ?? ''),
    message: String(row.message ?? data.message ?? ''),
    status: ticketStatus(row.status ?? data.status),
    ...(adminResponse ? { adminResponse } : {}),
    ...(respondedAt > 0 ? { respondedAt } : {}),
    createdAt,
  };
}

const customerVisibleOrderFields = [
  'customerName', 'customerPhone', 'customerAddress', 'customerEmail', 'recipientName',
  'recipientPhone', 'recipientAddress', 'deliveryCity', 'orderSourceId', 'orderSourceName',
  'orderSourceType', 'externalOrderNumber', 'cartShareCode', 'goodsDescription', 'totalWeight',
  'totalCBM', 'packagingType', 'packagingFee', 'isUrgent', 'packageType', 'currency',
  'productsSum', 'shippingCostSAR', 'companyProfitSAR', 'totalCostSAR', 'exchangeRateYER',
  'deliveryCourierFee', 'totalCostYER', 'amountRemaining', 'paymentStatus', 'paymentMethod',
  'customerNote', 'source', 'customerEstimate', 'items',
] as const;

function toOrder(row: Record<string, unknown>): PortalOrderDto {
  const data = asRecord(row.data);
  const createdAt = timestamp(row.createdAt);
  const safeData: Record<string, unknown> = {};
  for (const key of customerVisibleOrderFields) {
    if (key in data) safeData[key] = data[key];
  }
  const items = Array.isArray(safeData.items)
    ? safeData.items.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        productName: typeof item.productName === 'string' ? item.productName : '',
        productUrl: typeof item.productUrl === 'string' ? item.productUrl : '',
        quantity: typeof item.quantity === 'number' ? item.quantity : 0,
        productPrice: typeof item.productPrice === 'number' ? item.productPrice : 0,
        weight: typeof item.weight === 'number' ? item.weight : 0,
        cbm: typeof item.cbm === 'number' ? item.cbm : 0,
        length: typeof item.length === 'number' ? item.length : 0,
        width: typeof item.width === 'number' ? item.width : 0,
        height: typeof item.height === 'number' ? item.height : 0,
        trackingNumber: typeof item.trackingNumber === 'string' ? item.trackingNumber : '',
      }))
    : [];

  return {
    ...safeData,
    id: String(row.orderId),
    orderNumber: String(row.orderNumber),
    trackingNumber: String(row.trackingNumber ?? row.orderNumber),
    status: String(data.status ?? row.orderStatus ?? 'pending'),
    orderStatus: String(data.orderStatus ?? row.orderStatus ?? 'pending'),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : createdAt,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt,
    items,
  };
}

function toCustomerDetails(row: Record<string, unknown>, fallbackCustomerId = ''): PortalCustomerDetailsDto {
  const data = asRecord(row.data);
  const output: PortalCustomerDetailsDto = {
    id: String(row.id ?? row.detailId ?? ''),
    userUid: String(row.userUid ?? ''),
    customerId: String(row.customerId ?? fallbackCustomerId),
    privacyPolicyAgreed: Boolean(row.privacyPolicyAgreed ?? data.privacyPolicyAgreed),
    preferredCategories: Array.isArray(data.preferredCategories)
      ? data.preferredCategories.filter((value): value is string => typeof value === 'string')
      : [],
    joinBy: String(row.joinBy ?? data.joinBy ?? ''),
    referrerId: String(row.referrerId ?? data.referrerId ?? ''),
    onboardingCompleted: Boolean(row.onboardingCompleted ?? data.onboardingCompleted),
    createdAt: timestamp(row.createdAt ?? data.createdAt),
    updatedAt: timestamp(row.updatedAt ?? data.updatedAt),
  };
  const privacyPolicyAgreedAt = timestamp(row.privacyPolicyAgreedAt ?? data.privacyPolicyAgreedAt);
  if (privacyPolicyAgreedAt > 0) output.privacyPolicyAgreedAt = privacyPolicyAgreedAt;
  const gender = row.gender ?? data.gender;
  if (gender === 'male' || gender === 'female' || gender === 'other') output.gender = gender;
  const age = row.age ?? data.age;
  if (typeof age === 'number' && Number.isFinite(age)) output.age = age;
  const location = asRecord(data.location);
  if (Object.keys(location).length > 0) output.location = location;
  const bodyDetails = asRecord(data.bodyDetails ?? row.bodyDetails);
  if (Object.keys(bodyDetails).length > 0) output.bodyDetails = bodyDetails;
  const acquisitionSource = asRecord(data.acquisitionSource);
  if (Object.keys(acquisitionSource).length > 0) output.acquisitionSource = acquisitionSource;
  return output;
}

async function withTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [cause, rollbackError],
        'Portal resource transaction and rollback failed.',
        { cause: rollbackError },
      );
    }
    throw cause;
  } finally {
    client.release();
  }
}

export function createPortalOwnedRepository(pool: Pool): PortalOwnedRepository {
  return {
    async listTickets(input) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT portal_ticket_id AS id, user_uid AS "userUid", type, subject, message, status,
                replies, data, created_at AS "createdAt"
           FROM public.portal_tickets
          WHERE user_uid = $1
          ORDER BY created_at DESC NULLS LAST, portal_ticket_id DESC
          LIMIT $2 OFFSET $3`,
        [input.portalUserId, input.limit, input.offset],
      );
      return result.rows.map(toTicket);
    },

    async createTicket(input) {
      const result = await pool.query<Record<string, unknown>>(
        `INSERT INTO public.portal_tickets
           (portal_ticket_id, user_uid, type, subject, message, status, replies, data,
            created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'open', '[]'::jsonb, $6::jsonb,
                 $2, $2, $7, $7)
         RETURNING portal_ticket_id AS id, user_uid AS "userUid", type, subject, message,
                   status, replies, data, created_at AS "createdAt"`,
        [
          input.ticketId,
          input.portalUserId,
          input.type,
          input.subject,
          input.message,
          JSON.stringify({ userName: input.userName, userRole: input.userRole, type: input.type, subject: input.subject, message: input.message }),
          input.createdAt,
        ],
      );
      return toTicket(result.rows[0] ?? {});
    },

    async listCustomerOrders(input) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT order_id AS "orderId", order_number AS "orderNumber",
                tracking_number AS "trackingNumber", order_status1 AS "orderStatus",
                created_at AS "createdAt", data
           FROM public.orders
          WHERE customer_id = $1
             OR (order_party_type = 'customer' AND order_party_id = $1)
          ORDER BY created_at DESC, order_id DESC
          LIMIT $2 OFFSET $3`,
        [input.customerId, input.limit, input.offset],
      );
      return result.rows.map(toOrder);
    },

    async createCustomerOrder(input) {
      return withTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.idempotencyKey]);
        const previous = await client.query<{ operation: string; responseData: Record<string, unknown> }>(
          `SELECT operation, response_data AS "responseData"
            FROM alx_api_private.operation_idempotency
            WHERE idempotency_key = $1
            LIMIT 1`,
          [input.idempotencyKey],
        );
        if (previous.rows[0]) {
          if (previous.rows[0].operation !== 'portal.order.create') throw new Error('IDEMPOTENCY_KEY_CONFLICT');
          return previous.rows[0].responseData as unknown as PortalOrderDto;
        }

        if (input.sourceId) {
          const source = await client.query(
            'SELECT source_id FROM public.sources WHERE source_id = $1 AND is_active = true LIMIT 1',
            [input.sourceId],
          );
          if (!source.rows[0]) throw new Error('PORTAL_ORDER_SOURCE_NOT_ACTIVE');
        }

        await client.query(
          `INSERT INTO public.orders
             (order_id, order_number, customer_id, tracking_number, order_status1,
              order_source_id, order_source_type, order_party_id, order_party_type,
              is_staff_order, order_party_account_id, data, created_by, created_by_name,
              updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'معلق', $5, $6, $3, 'customer', false, $7, $8::jsonb, $9, $10, $9, $11, $11)`,
          [
            input.orderId, input.orderNumber, input.customerId, input.trackingNumber,
            input.sourceId ?? null, input.sourceType, input.financialAccountId,
            JSON.stringify(input.orderData), input.portalUserId, input.customerName,
            input.createdAt,
          ],
        );

        for (const item of input.items) {
          await client.query(
            `INSERT INTO public.order_items
               (order_item_id, order_id, product_id, product_name, product_price, product_url,
                nota, quantity, total_price, total__weight, total_cbm, items_status,
                created_by, updated_by, created_at, updated_at)
             VALUES ($1, $2, NULL, $3, $4, $5, NULL, $6, $7, $8, $9,
                     'قيد الطلب', $10, $10, $11, $11)`,
            [
              item.id, input.orderId, item.productName, item.productPrice, item.productUrl ?? null,
              item.quantity, item.quantity * item.productPrice, item.quantity * item.weight,
              item.quantity * item.cbm, input.portalUserId, input.createdAt,
            ],
          );
        }

        await client.query(
          `INSERT INTO public.orders_history
             (orders_history_id, order_id, order_number, event_type, event_category, operation,
              entity_type, actor_id, source, summary, before_data, after_data, metadata,
              occurred_at, created_by, updated_by)
           VALUES ($1, $2, $3, 'order.created', 'api', 'create', 'order', $4, 'alx_api',
                   'Portal customer submitted an order for review.', NULL, $5::jsonb,
                   '{}'::jsonb, $6, $4, $4)`,
          [
            `hist_${randomUUID()}`,
            input.orderId,
            input.orderNumber,
            input.portalUserId,
            JSON.stringify({ status: 'pending', itemCount: input.items.length, portalUserId: input.portalUserId }),
            input.createdAt,
          ],
        );

        const created = toOrder({
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          trackingNumber: input.trackingNumber,
          orderStatus: 'معلق',
          createdAt: input.createdAt,
          data: input.orderData,
        });
        await client.query(
          `INSERT INTO alx_api_private.operation_idempotency (idempotency_key, operation, response_data)
           VALUES ($1, 'portal.order.create', $2::jsonb)`,
          [input.idempotencyKey, JSON.stringify(created)],
        );
        return created;
      });
    },

    async findActiveOrderSource(sourceId) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT source_id AS id, COALESCE(NULLIF(name, ''), NULLIF(name_ar, ''), NULLIF(name_en, ''), '') AS name,
                COALESCE(NULLIF(type, ''), 'App') AS type
           FROM public.sources
          WHERE source_id = $1 AND is_active = true
          LIMIT 1`,
        [sourceId],
      );
      const row = result.rows[0];
      return row ? { id: String(row.id), name: String(row.name), type: String(row.type) } : null;
    },

    async getCustomerOrderPricingSettings(): Promise<PortalOrderPricingSettings> {
      const result = await pool.query<{ data: unknown }>(
        'SELECT data FROM public.settings WHERE setting_id = $1 LIMIT 1',
        ['general'],
      );
      const data = asRecord(result.rows[0]?.data);
      const numberOrDefault = (value: unknown, fallback: number, allowZero = false): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0) ? parsed : fallback;
      };
      const exchangeRate = data.exchangeRateSAR ?? data.exchangeRateYER;
      const deliveryFee = data.defaultDeliveryFee ?? data.defaultDeliveryRate;
      return {
        exchangeRateYER: numberOrDefault(exchangeRate, 390),
        defaultDeliveryFeeYER: numberOrDefault(deliveryFee, 4_000),
        defaultCompanyProfitRate: numberOrDefault(data.defaultCompanyProfitRate, 12),
        defaultPackagingFeeSAR: numberOrDefault(data.defaultPackagingFee, 0, true),
      };
    },

    async getCustomerDetails(portalUserId) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT cust_detail_id AS id, user_uid AS "userUid", customer_id AS "customerId",
                join_by AS "joinBy", referrer_id AS "referrerId",
                onboarding_completed AS "onboardingCompleted", data, age, gender, country, city,
                body_details AS "bodyDetails", privacy_policy_agreed AS "privacyPolicyAgreed",
                privacy_policy_agreed_at AS "privacyPolicyAgreedAt",
                created_at AS "createdAt", updated_at AS "updatedAt"
           FROM public.cust_details
          WHERE user_uid = $1
          ORDER BY created_at DESC NULLS LAST, cust_detail_id DESC
          LIMIT 1`,
        [portalUserId],
      );
      return result.rows[0] ? toCustomerDetails(result.rows[0]) : null;
    },

    async saveCustomerDetails(input) {
      return withTransaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`portal-customer-details:${input.portalUserId}`]);
        const found = await client.query<Record<string, unknown>>(
          `SELECT cust_detail_id AS id, user_uid AS "userUid", customer_id AS "customerId",
                  join_by AS "joinBy", referrer_id AS "referrerId",
                  onboarding_completed AS "onboardingCompleted", data, age, gender, country, city,
                  body_details AS "bodyDetails", privacy_policy_agreed AS "privacyPolicyAgreed",
                  privacy_policy_agreed_at AS "privacyPolicyAgreedAt",
                  created_at AS "createdAt", updated_at AS "updatedAt"
             FROM public.cust_details
            WHERE user_uid = $1
            ORDER BY created_at DESC NULLS LAST, cust_detail_id DESC
            LIMIT 1
            FOR UPDATE`,
          [input.portalUserId],
        );
        const existing = found.rows[0] ?? {};
        const previousData = asRecord(existing.data);
        const updates: PortalCustomerDetailsUpdateInput = input.details;
        const privacyPolicyAgreed = updates.privacyPolicyAgreed
          ?? Boolean(existing.privacyPolicyAgreed ?? previousData.privacyPolicyAgreed);
        const joinBy = updates.joinBy ?? String(asRecord(updates.acquisitionSource).joinBy ?? existing.joinBy ?? '');
        const referrerId = updates.referrerId ?? String(asRecord(updates.acquisitionSource).referrerId ?? existing.referrerId ?? '');
        const onboardingCompleted = updates.onboardingCompleted
          ?? Boolean(existing.onboardingCompleted ?? previousData.onboardingCompleted);
        const location = { ...asRecord(previousData.location), ...(updates.location ?? {}) };
        const requiredLocationFields = [location.country, location.governorate, location.city, location.street];
        const hasRequiredLocation = requiredLocationFields.every((value) =>
          typeof value === 'string' && value.trim().length > 0,
        ) && typeof location.lat === 'number' && typeof location.lng === 'number';
        if (onboardingCompleted && !privacyPolicyAgreed) throw new Error('CUSTOMER_PRIVACY_AGREEMENT_REQUIRED');
        if (onboardingCompleted && !hasRequiredLocation) throw new Error('CUSTOMER_LOCATION_REQUIRED');

        const createdAt = existing.createdAt ?? input.updatedAt;
        const age = updates.age ?? previousData.age ?? existing.age ?? null;
        const gender = updates.gender ?? previousData.gender ?? existing.gender ?? null;
        const country = typeof location.country === 'string' ? location.country : existing.country ?? null;
        const city = typeof location.city === 'string' ? location.city : existing.city ?? null;
        const bodyDetails = { ...asRecord(previousData.bodyDetails), ...(updates.bodyDetails ?? {}) };
        const privacyPolicyAgreedAt = privacyPolicyAgreed
          ? previousData.privacyPolicyAgreedAt ?? (timestamp(existing.privacyPolicyAgreedAt) || input.updatedAt.getTime())
          : undefined;
        const data: Record<string, unknown> = {
          ...previousData,
          ...updates,
          location,
          bodyDetails,
          age,
          gender,
          privacyPolicyAgreed,
          joinBy,
          referrerId,
          onboardingCompleted,
          createdAt: timestamp(createdAt),
          updatedAt: input.updatedAt.getTime(),
          ...(privacyPolicyAgreedAt !== undefined ? { privacyPolicyAgreedAt } : {}),
        };
        if (privacyPolicyAgreedAt === undefined) delete data.privacyPolicyAgreedAt;
        const privacyPolicyAgreedAtDate = privacyPolicyAgreedAt === undefined
          ? null
          : new Date(timestamp(privacyPolicyAgreedAt));

        const detailId = String(existing.id ?? `cd_${randomUUID()}`);
        const saved = existing.id
          ? await client.query<Record<string, unknown>>(
            `UPDATE public.cust_details
                SET customer_id = $2, join_by = NULLIF($3, ''), referrer_id = NULLIF($4, ''),
                    onboarding_completed = $5, data = $6::jsonb, age = $7, gender = $8,
                    country = $9, city = $10, body_details = $11,
                    privacy_policy_agreed = $12, privacy_policy_agreed_at = $13, updated_at = $14
              WHERE cust_detail_id = $1
              RETURNING cust_detail_id AS id, user_uid AS "userUid", customer_id AS "customerId",
                        join_by AS "joinBy", referrer_id AS "referrerId",
                        onboarding_completed AS "onboardingCompleted", data, age, gender, country, city,
                        body_details AS "bodyDetails", privacy_policy_agreed AS "privacyPolicyAgreed",
                        privacy_policy_agreed_at AS "privacyPolicyAgreedAt",
                        created_at AS "createdAt", updated_at AS "updatedAt"`,
            [detailId, input.customerId, joinBy, referrerId, onboardingCompleted, JSON.stringify(data), age, gender, country, city, JSON.stringify(bodyDetails), privacyPolicyAgreed, privacyPolicyAgreedAtDate, input.updatedAt],
          )
          : await client.query<Record<string, unknown>>(
            `INSERT INTO public.cust_details
               (cust_detail_id, user_uid, customer_id, join_by, referrer_id, onboarding_completed,
                data, age, gender, country, city, body_details, privacy_policy_agreed,
                privacy_policy_agreed_at, created_at, updated_at)
             VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7::jsonb,
                     $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING cust_detail_id AS id, user_uid AS "userUid", customer_id AS "customerId",
                       join_by AS "joinBy", referrer_id AS "referrerId",
                       onboarding_completed AS "onboardingCompleted", data, age, gender, country, city,
                       body_details AS "bodyDetails", privacy_policy_agreed AS "privacyPolicyAgreed",
                       privacy_policy_agreed_at AS "privacyPolicyAgreedAt",
                       created_at AS "createdAt", updated_at AS "updatedAt"`,
            [detailId, input.portalUserId, input.customerId, joinBy, referrerId, onboardingCompleted, JSON.stringify(data), age, gender, country, city, JSON.stringify(bodyDetails), privacyPolicyAgreed, privacyPolicyAgreedAtDate, createdAt, input.updatedAt],
          );

        await client.query(
          `UPDATE public.portal_users
              SET join_by = NULLIF($2, ''), referrer_id = NULLIF($3, ''),
                  onboarding_completed = $4, updated_at = $5
            WHERE portal_user_id = $1`,
          [input.portalUserId, joinBy, referrerId, onboardingCompleted, input.updatedAt],
        );
        await client.query(
          `UPDATE public.customers
              SET join_by = NULLIF($2, ''), referrer_id = NULLIF($3, ''),
                  onboarding_completed = $4, updated_at = $5
            WHERE customer_id = $1`,
          [input.customerId, joinBy, referrerId, onboardingCompleted, input.updatedAt],
        );
        if (!saved.rows[0]) throw new Error('CUSTOMER_DETAILS_SAVE_FAILED');
        return toCustomerDetails(saved.rows[0], input.customerId);
      });
    },
  };
}
