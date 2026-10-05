import type { Pool, PoolClient } from 'pg';
import type {
  CreateOrderInput,
  CreateProductInput,
  OperationsRepository,
  PageQuery,
  PageResult,
  UpdateOrderStatusInput,
  UpdateProductInput,
  UpdateShipmentInput,
} from './operations.contracts';

const orderItemColumns =
  'order_item_id AS "orderItemId", order_id AS "orderId", product_id AS "productId", product_price AS "productPrice", product_url AS "productUrl", tracking_number AS "trackingNumber", produc_source_id AS "productSourceId", produc_source_url AS "productSourceUrl", product_color AS "productColor", product_name AS "productName", sku, nota, internal_note AS "internalNote", customer_note AS "customerNote", quantity, total_price AS "totalPrice", unit__weight AS "unitWeight", total__weight AS "totalWeight", unit_cbm AS "unitCbm", total_cbm AS "totalCbm", packaging_option_id AS "packagingOptionId", packaging_option_price AS "packagingOptionPrice", total_packaging_price AS "totalPackagingPrice", is_insured AS "isInsured", insurance_fee AS "insuranceFee", items_status AS "itemsStatus", shipment_id AS "shipmentId", created_at AS "createdAt", updated_at AS "updatedAt"';
const shipmentColumns =
  'shipment_id AS "shipmentId", order_id AS "orderId", tracking_number AS "trackingNumber", shipping_company_id AS "shippingCompanyId", courier_id AS "courierId", shipment_status AS "shipmentStatus", shipping_cost AS "shippingCost", weight, shipping_type AS "shippingType", shipping_source AS "shippingSource", shipping_destination AS "shippingDestination", shipping_date AS "shippingDate", shipping_duration AS "shippingDuration", expected_arrival AS "expectedArrival", delivery_date AS "deliveryDate", carton_count AS "cartonCount", customs_fee AS "customsFee", tax_fee AS "taxFee", other_category_fee AS "otherCategoryFee", category_fees_total AS "categoryFeesTotal", category_fee_currency AS "categoryFeeCurrency", created_at AS "createdAt", updated_at AS "updatedAt"';

async function page(
  pool: Pool,
  table: string,
  columns: string,
  order: string,
  input: PageQuery,
  searchColumns: string[],
): Promise<PageResult<Record<string, unknown>>> {
  const values: unknown[] = [];
  const where = input.search ? `WHERE (${searchColumns.map((column) => `${column} ILIKE $1`).join(' OR ')})` : '';
  if (input.search) values.push(`%${input.search}%`);
  values.push(input.limit, input.offset);
  const result = await pool.query<Record<string, unknown>>(
    `SELECT ${columns}, count(*) OVER()::text AS _total FROM public.${table} ${where} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(({ _total, ...row }) => row), total: Number(result.rows[0]?._total ?? 0) };
}

function statusRank(status: string): number {
  const normalized = status.trim().toLowerCase();
  const ranks: Record<string, number> = {
    pending: 0,
    new: 0,
    created: 0,
    'قيد الطلب': 0,
    confirmed: 1,
    processing: 1,
    'قيد التجهيز': 1,
    shipped: 2,
    in_transit: 2,
    'تم الشحن': 2,
    delivered: 3,
    completed: 3,
    'تم التسليم': 3,
    cancelled: 4,
    canceled: 4,
    ملغي: 4,
  };
  return ranks[normalized] ?? -1;
}

async function writeHistory(
  client: PoolClient,
  input: {
    orderId: string;
    orderNumber: string;
    actorId: string;
    eventType: string;
    operation: string;
    beforeData?: unknown;
    afterData?: unknown;
    shipmentId?: string;
    summary: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO public.orders_history
      (orders_history_id, order_id, order_number, shipment_id, event_type, event_category, operation, entity_type, actor_id, source, summary, before_data, after_data, metadata, occurred_at, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'api', $6, 'order', $7, 'alx_api', $8, $9::jsonb, $10::jsonb, '{}'::jsonb, NOW(), $7, $7)`,
    [
      `hist_${crypto.randomUUID()}`,
      input.orderId,
      input.orderNumber,
      input.shipmentId ?? null,
      input.eventType,
      input.operation,
      input.actorId,
      input.summary,
      JSON.stringify(input.beforeData ?? null),
      JSON.stringify(input.afterData ?? null),
    ],
  );
}

export function createOperationsRepository(pool: Pool): OperationsRepository {
  return {
    listOrders: (input) =>
      page(
        pool,
        'orders',
        'order_id AS "orderId", order_number AS "orderNumber", tracking_number AS "trackingNumber", customer_id AS "customerId", order_status_id AS "orderStatusId", order_status1 AS "orderStatus", order_party_id AS "orderPartyId", order_party_type AS "orderPartyType", delivery_courier_id AS "deliveryCourierId", shipping_courier_id AS "shippingCourierId", currency, order_currency AS "orderCurrency", order_currency_price AS "orderCurrencyPrice", external_order_number AS "externalOrderNumber", created_at AS "createdAt", updated_at AS "updatedAt"',
        'created_at DESC, order_id ASC',
        input,
        ['order_number', 'external_order_number', 'tracking_number'],
      ),
    async getOrder(orderId) {
      const result = await pool.query(
        'SELECT order_id AS "orderId", order_number AS "orderNumber", tracking_number AS "trackingNumber", customer_id AS "customerId", order_status_id AS "orderStatusId", order_status1 AS "orderStatus", order_party_id AS "orderPartyId", order_party_type AS "orderPartyType", delivery_courier_id AS "deliveryCourierId", shipping_courier_id AS "shippingCourierId", currency, order_currency AS "orderCurrency", order_currency_price AS "orderCurrencyPrice", external_order_number AS "externalOrderNumber", data, created_at AS "createdAt", updated_at AS "updatedAt" FROM public.orders WHERE order_id = $1 LIMIT 1',
        [orderId],
      );
      if (!result.rows[0]) return null;
      const items = await pool.query(
        `SELECT ${orderItemColumns} FROM public.order_items WHERE order_id = $1 ORDER BY created_at ASC, order_item_id ASC`,
        [orderId],
      );
      const shipments = await pool.query(
        `SELECT ${shipmentColumns} FROM public.shipments WHERE order_id = $1 ORDER BY created_at ASC, shipment_id ASC`,
        [orderId],
      );
      return { ...result.rows[0], items: items.rows, shipments: shipments.rows };
    },
    async listOrderHistory(orderId) {
      const result = await pool.query(
        'SELECT orders_history_id AS "historyId", order_id AS "orderId", order_number AS "orderNumber", shipment_id AS "shipmentId", event_type AS "eventType", event_category AS "eventCategory", operation, entity_type AS "entityType", actor_id AS "actorId", actor_name AS "actorName", actor_role AS "actorRole", source, summary, before_data AS "beforeData", after_data AS "afterData", metadata, occurred_at AS "occurredAt" FROM public.orders_history WHERE order_id = $1 ORDER BY occurred_at ASC, orders_history_id ASC',
        [orderId],
      );
      return result.rows;
    },
    listShipments: (input) =>
      page(
        pool,
        'shipments',
        'shipment_id AS "shipmentId", order_id AS "orderId", tracking_number AS "trackingNumber", shipping_company_id AS "shippingCompanyId", courier_id AS "courierId", shipment_status AS "shipmentStatus", shipping_cost AS "shippingCost", weight, shipping_type AS "shippingType", shipping_source AS "shippingSource", shipping_destination AS "shippingDestination", shipping_date AS "shippingDate", expected_arrival AS "expectedArrival", delivery_date AS "deliveryDate", carton_count AS "cartonCount", customs_fee AS "customsFee", tax_fee AS "taxFee", category_fees_total AS "categoryFeesTotal", created_at AS "createdAt", updated_at AS "updatedAt"',
        'created_at DESC NULLS LAST, shipment_id ASC',
        input,
        ['tracking_number', 'order_id', 'shipment_status'],
      ),
    async getShipment(shipmentId) {
      const result = await pool.query(
        `SELECT ${shipmentColumns} FROM public.shipments WHERE shipment_id = $1 LIMIT 1`,
        [shipmentId],
      );
      return result.rows[0] ?? null;
    },
    async listTracking(shipmentId) {
      const result = await pool.query(
        'SELECT orders_history_id AS "historyId", order_id AS "orderId", order_number AS "orderNumber", shipment_id AS "shipmentId", event_type AS "eventType", event_category AS "eventCategory", operation, summary, after_data AS "afterData", metadata, occurred_at AS "occurredAt" FROM public.orders_history WHERE shipment_id = $1 ORDER BY occurred_at ASC, orders_history_id ASC',
        [shipmentId],
      );
      return result.rows;
    },
    listProducts: (input) =>
      page(
        pool,
        'products',
        'product_id AS "productId", product_name_ar AS "productNameAr", product_name_en AS "productNameEn", product_url AS "productUrl", product_price_currency AS "productPriceCurrency", unit_price AS "unitPrice", item_category_id AS "itemCategoryId", cbm, width, height, length, weight, created_at AS "createdAt", updated_at AS "updatedAt"',
        'created_at DESC NULLS LAST, product_id ASC',
        input,
        ['product_name_ar', 'product_name_en', 'product_id'],
      ),
    async getProduct(productId) {
      const result = await pool.query(
        'SELECT product_id AS "productId", product_name_ar AS "productNameAr", product_name_en AS "productNameEn", product_url AS "productUrl", product_price_currency AS "productPriceCurrency", unit_price AS "unitPrice", item_category_id AS "itemCategoryId", cbm, width, height, length, weight, created_at AS "createdAt", updated_at AS "updatedAt" FROM public.products WHERE product_id = $1 LIMIT 1',
        [productId],
      );
      return result.rows[0] ?? null;
    },
    async createOrder(input: CreateOrderInput) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const idem = await client.query(
          'SELECT response_data FROM alx_api_private.operation_idempotency WHERE idempotency_key = $1 FOR UPDATE',
          [input.idempotencyKey],
        );
        if (idem.rows[0]) {
          await client.query('COMMIT');
          return idem.rows[0].response_data as Record<string, unknown>;
        }
        const orderId = input.orderNumber;
        const inserted = await client.query(
          `INSERT INTO public.orders (order_id, order_number, customer_id, tracking_number, order_status_id, order_status1, currency, order_currency, order_currency_price, external_order_number, created_by, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, NOW(), NOW()) RETURNING order_id AS "orderId", order_number AS "orderNumber", order_status1 AS "orderStatus", created_at AS "createdAt"`,
          [
            orderId,
            input.orderNumber,
            input.customerId ?? null,
            input.trackingNumber ?? null,
            input.orderStatusId ?? null,
            input.status ?? 'pending',
            input.currency ?? null,
            input.orderCurrency ?? null,
            input.orderCurrencyPrice ?? null,
            input.externalOrderNumber ?? null,
            input.actorId,
          ],
        );
        for (const item of input.items) {
          const productId = item.productId ?? `prod_${crypto.randomUUID()}`;
          if (!item.productId)
            await client.query(
              'INSERT INTO public.products (product_id, product_name_ar, product_name_en, product_url, unit_price, cbm, weight, created_by, updated_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, NOW(), NOW())',
              [
                productId,
                item.productNameAr ?? item.productName ?? 'منتج',
                item.productNameEn ?? item.productName ?? 'Product',
                item.productUrl ?? null,
                item.unitPrice,
                item.cbm ?? 0,
                item.weight ?? 0,
                input.actorId,
              ],
            );
          await client.query(
            'INSERT INTO public.order_items (order_item_id, order_id, product_id, product_price, product_url, nota, quantity, total_price, total__weight, total_cbm, items_status, created_by, updated_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, NOW(), NOW())',
            [
              `item_${crypto.randomUUID()}`,
              orderId,
              productId,
              item.unitPrice,
              item.productUrl ?? null,
              item.notes ?? null,
              item.quantity,
              item.unitPrice * item.quantity,
              (item.weight ?? 0) * item.quantity,
              (item.cbm ?? 0) * item.quantity,
              'pending',
              input.actorId,
            ],
          );
        }
        let shipment: Record<string, unknown> | undefined;
        if (input.shipment) {
          const s = input.shipment;
          const result = await client.query(
            'INSERT INTO public.shipments (shipment_id, order_id, tracking_number, shipping_company_id, courier_id, shipment_status, shipping_cost, weight, shipping_type, shipping_source, shipping_destination, carton_count, created_by, updated_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, NOW(), NOW()) RETURNING shipment_id AS "shipmentId", order_id AS "orderId", shipment_status AS "shipmentStatus"',
            [
              `sh_${crypto.randomUUID()}`,
              orderId,
              s.trackingNumber ?? input.trackingNumber ?? orderId,
              s.shippingCompanyId ?? null,
              s.courierId ?? null,
              s.shipmentStatus ?? 'pending',
              s.shippingCost ?? 0,
              s.weight ?? 0,
              s.shippingType ?? null,
              s.shippingSource ?? null,
              s.shippingDestination ?? null,
              s.cartonCount ?? 0,
              input.actorId,
            ],
          );
          shipment = result.rows[0];
        }
        const historyInput = {
          orderId,
          orderNumber: input.orderNumber,
          actorId: input.actorId,
          eventType: 'order.created',
          operation: 'create',
          afterData: { status: input.status ?? 'pending', items: input.items.length },
          summary: 'تم إنشاء الطلب.',
        };
        if (shipment?.shipmentId)
          await writeHistory(client, { ...historyInput, shipmentId: String(shipment.shipmentId) });
        else await writeHistory(client, historyInput);
        const response = { ...inserted.rows[0], itemCount: input.items.length, shipment };
        await client.query(
          'INSERT INTO alx_api_private.operation_idempotency (idempotency_key, operation, response_data) VALUES ($1, $2, $3::jsonb)',
          [input.idempotencyKey, 'order.create', JSON.stringify(response)],
        );
        await client.query('COMMIT');
        return response;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateOrderStatus(input: UpdateOrderStatusInput) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query(
          'SELECT order_id AS "orderId", order_number AS "orderNumber", order_status1 AS "status" FROM public.orders WHERE order_id = $1 FOR UPDATE',
          [input.orderId],
        );
        if (!current.rows[0]) {
          await client.query('ROLLBACK');
          return { notFound: true };
        }
        const previous = String(current.rows[0].status ?? 'pending');
        if (statusRank(input.status) < statusRank(previous)) throw new Error('ORDER_STATUS_REGRESSION');
        const updated = await client.query(
          'UPDATE public.orders SET order_status1 = $1, updated_by = $2, updated_at = NOW() WHERE order_id = $3 RETURNING order_id AS "orderId", order_number AS "orderNumber", order_status1 AS "status", updated_at AS "updatedAt"',
          [input.status, input.actorId, input.orderId],
        );
        await writeHistory(client, {
          orderId: input.orderId,
          orderNumber: String(current.rows[0].orderNumber),
          actorId: input.actorId,
          eventType: 'order.status_changed',
          operation: 'update',
          beforeData: { status: previous },
          afterData: { status: input.status, note: input.note ?? null },
          summary: 'تم تغيير حالة الطلب.',
        });
        await client.query('COMMIT');
        return updated.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createProduct(input: CreateProductInput) {
      const result = await pool.query(
        'INSERT INTO public.products (product_id, product_name_ar, product_name_en, product_url, product_price_currency, unit_price, item_category_id, cbm, width, height, length, weight, created_by, updated_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, NOW(), NOW()) RETURNING product_id AS "productId", product_name_ar AS "productNameAr", product_name_en AS "productNameEn", unit_price AS "unitPrice", updated_at AS "updatedAt"',
        [
          input.productId,
          input.productNameAr ?? null,
          input.productNameEn ?? null,
          input.productUrl ?? null,
          input.productPriceCurrency ?? null,
          input.unitPrice ?? 0,
          input.itemCategoryId ?? null,
          input.cbm ?? 0,
          input.width ?? 0,
          input.height ?? 0,
          input.length ?? 0,
          input.weight ?? 0,
          input.actorId,
        ],
      );
      return result.rows[0];
    },
    async updateProduct(input: UpdateProductInput) {
      const result = await pool.query(
        'UPDATE public.products SET product_name_ar = COALESCE($1, product_name_ar), product_name_en = COALESCE($2, product_name_en), product_url = COALESCE($3, product_url), unit_price = COALESCE($4, unit_price), item_category_id = COALESCE($5, item_category_id), cbm = COALESCE($6, cbm), width = COALESCE($7, width), height = COALESCE($8, height), length = COALESCE($9, length), weight = COALESCE($10, weight), updated_by = $11, updated_at = NOW() WHERE product_id = $12 RETURNING product_id AS "productId", product_name_ar AS "productNameAr", product_name_en AS "productNameEn", unit_price AS "unitPrice", updated_at AS "updatedAt"',
        [
          input.productNameAr,
          input.productNameEn,
          input.productUrl,
          input.unitPrice,
          input.itemCategoryId,
          input.cbm,
          input.width,
          input.height,
          input.length,
          input.weight,
          input.actorId,
          input.productId,
        ],
      );
      return result.rows[0] ?? null;
    },
    async updateShipment(input: UpdateShipmentInput) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const before = await client.query(
          `SELECT ${shipmentColumns} FROM public.shipments WHERE shipment_id = $1 FOR UPDATE`,
          [input.shipmentId],
        );
        if (!before.rows[0]) {
          await client.query('ROLLBACK');
          return null;
        }
        const order = await client.query<{ orderNumber: string }>(
          'SELECT order_number AS "orderNumber" FROM public.orders WHERE order_id = $1 LIMIT 1',
          [before.rows[0].orderId],
        );
        const result = await client.query(
          `UPDATE public.shipments SET shipment_status = COALESCE($1, shipment_status), courier_id = COALESCE($2, courier_id), tracking_number = COALESCE($3, tracking_number), shipping_cost = COALESCE($4, shipping_cost), weight = COALESCE($5, weight), shipping_type = COALESCE($6, shipping_type), shipping_source = COALESCE($7, shipping_source), shipping_destination = COALESCE($8, shipping_destination), carton_count = COALESCE($9, carton_count), updated_by = $10, updated_at = NOW() WHERE shipment_id = $11 RETURNING ${shipmentColumns}`,
          [
            input.shipmentStatus,
            input.courierId,
            input.trackingNumber,
            input.shippingCost,
            input.weight,
            input.shippingType,
            input.shippingSource,
            input.shippingDestination,
            input.cartonCount,
            input.actorId,
            input.shipmentId,
          ],
        );
        const after = result.rows[0];
        await writeHistory(client, {
          orderId: String(after.orderId),
          orderNumber: String(order.rows[0]?.orderNumber ?? before.rows[0].orderId),
          shipmentId: input.shipmentId,
          actorId: input.actorId,
          eventType: input.courierId ? 'shipment.courier_assigned' : 'shipment.updated',
          operation: 'update',
          beforeData: before.rows[0],
          afterData: after,
          summary: input.courierId ? 'تم إسناد الشحنة إلى مندوب.' : 'تم تحديث الشحنة.',
        });
        await client.query('COMMIT');
        return after;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createCourier(input) {
      const courierId = input.courierId ?? `cour_${crypto.randomUUID()}`;
      const result = await pool.query(
        `INSERT INTO public.couriers (courier_id, account_id, currency, is_active, full_name, name_ar, name_en, courier_type, courier_level, commission_rate, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $11)
         RETURNING courier_id AS "courierId", account_id AS "accountId", currency, is_active AS "isActive", full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", courier_type AS "courierType", courier_level AS "courierLevel", commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          courierId,
          input.accountId ?? null,
          input.currency ?? 'YER',
          input.isActive ?? true,
          input.fullName,
          input.nameAr ?? input.fullName,
          input.nameEn ?? input.fullName,
          input.courierType ?? null,
          input.courierLevel ?? null,
          input.commissionRate ?? 0,
          input.actorId,
        ],
      );
      return result.rows[0];
    },
    async updateCourier(input) {
      const result = await pool.query(
        `UPDATE public.couriers SET
           full_name = COALESCE($1, full_name),
           name_ar = COALESCE($2, name_ar),
           name_en = COALESCE($3, name_en),
           courier_type = COALESCE($4, courier_type),
           courier_level = COALESCE($5, courier_level),
           commission_rate = COALESCE($6, commission_rate),
           currency = COALESCE($7, currency),
           is_active = COALESCE($8, is_active),
           account_id = COALESCE($9, account_id),
           updated_by = $10,
           updated_at = NOW()
         WHERE courier_id = $11
         RETURNING courier_id AS "courierId", account_id AS "accountId", currency, is_active AS "isActive", full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", courier_type AS "courierType", courier_level AS "courierLevel", commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          input.fullName,
          input.nameAr,
          input.nameEn,
          input.courierType,
          input.courierLevel,
          input.commissionRate,
          input.currency,
          input.isActive,
          input.accountId,
          input.actorId,
          input.courierId,
        ],
      );
      return result.rows[0] ?? null;
    },
    async deleteCourier(courierId) {
      const result = await pool.query('DELETE FROM public.couriers WHERE courier_id = $1', [courierId]);
      return (result.rowCount ?? 0) > 0;
    },
    async createEmployee(input) {
      const employeeId = input.employeeId ?? `emp_${crypto.randomUUID()}`;
      const result = await pool.query(
        `INSERT INTO public.employees (employee_id, account_id, monthly_salary, currency, full_name, name_ar, name_en, job_type, commission_rate, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10, $10)
         RETURNING employee_id AS "employeeId", account_id AS "accountId", monthly_salary AS "monthlySalary", currency, full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", job_type AS "jobType", commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          employeeId,
          input.accountId ?? null,
          input.monthlySalary ?? 0,
          input.currency ?? 'YER',
          input.fullName,
          input.nameAr ?? input.fullName,
          input.nameEn ?? input.fullName,
          input.jobType ?? null,
          input.commissionRate ?? 0,
          input.actorId,
        ],
      );
      return result.rows[0];
    },
    async updateEmployee(input) {
      const result = await pool.query(
        `UPDATE public.employees SET
           full_name = COALESCE($1, full_name),
           name_ar = COALESCE($2, name_ar),
           name_en = COALESCE($3, name_en),
           job_type = COALESCE($4, job_type),
           monthly_salary = COALESCE($5, monthly_salary),
           commission_rate = COALESCE($6, commission_rate),
           currency = COALESCE($7, currency),
           account_id = COALESCE($8, account_id),
           updated_by = $9,
           updated_at = NOW()
         WHERE employee_id = $10
         RETURNING employee_id AS "employeeId", account_id AS "accountId", monthly_salary AS "monthlySalary", currency, full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", job_type AS "jobType", commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          input.fullName,
          input.nameAr,
          input.nameEn,
          input.jobType,
          input.monthlySalary,
          input.commissionRate,
          input.currency,
          input.accountId,
          input.actorId,
          input.employeeId,
        ],
      );
      return result.rows[0] ?? null;
    },
    async deleteEmployee(employeeId) {
      const result = await pool.query('DELETE FROM public.employees WHERE employee_id = $1', [employeeId]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
