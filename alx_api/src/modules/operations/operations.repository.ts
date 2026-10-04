import type { Pool } from 'pg';
import type { OperationsRepository, PageQuery, PageResult } from './operations.contracts';
async function page(
  pool: Pool,
  table: string,
  columns: string,
  order: string,
  input: PageQuery,
  searchColumns: string[],
): Promise<PageResult<Record<string, unknown>>> {
  const values: unknown[] = [];
  let where = '';
  if (input.search) {
    values.push(`%${input.search}%`);
    where = `WHERE (${searchColumns.map((column) => `${column} ILIKE $1`).join(' OR ')})`;
  }
  values.push(input.limit, input.offset);
  const result = await pool.query<Record<string, unknown>>(
    `SELECT ${columns}, count(*) OVER()::text AS _total FROM public.${table} ${where} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(({ _total, ...row }) => row), total: Number(result.rows[0]?._total ?? 0) };
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
        `SELECT order_id AS "orderId", order_number AS "orderNumber", tracking_number AS "trackingNumber", customer_id AS "customerId", order_status_id AS "orderStatusId", order_status1 AS "orderStatus", order_party_id AS "orderPartyId", order_party_type AS "orderPartyType", delivery_courier_id AS "deliveryCourierId", shipping_courier_id AS "shippingCourierId", currency, order_currency AS "orderCurrency", order_currency_price AS "orderCurrencyPrice", external_order_number AS "externalOrderNumber", data, created_at AS "createdAt", updated_at AS "updatedAt" FROM public.orders WHERE order_id = $1 LIMIT 1`,
        [orderId],
      );
      if (!result.rows[0]) return null;
      const items = await pool.query(
        'SELECT * FROM public.order_items WHERE order_id = $1 ORDER BY created_at ASC, order_item_id ASC',
        [orderId],
      );
      const shipments = await pool.query(
        'SELECT * FROM public.shipments WHERE order_id = $1 ORDER BY created_at ASC, shipment_id ASC',
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
        'SELECT shipment_id AS "shipmentId", order_id AS "orderId", tracking_number AS "trackingNumber", shipping_company_id AS "shippingCompanyId", courier_id AS "courierId", shipment_status AS "shipmentStatus", shipping_cost AS "shippingCost", weight, data, shipping_type AS "shippingType", shipping_source AS "shippingSource", shipping_destination AS "shippingDestination", shipping_date AS "shippingDate", expected_arrival AS "expectedArrival", delivery_date AS "deliveryDate", carton_count AS "cartonCount", customs_fee AS "customsFee", tax_fee AS "taxFee", category_fees_total AS "categoryFeesTotal", created_at AS "createdAt", updated_at AS "updatedAt" FROM public.shipments WHERE shipment_id = $1 LIMIT 1',
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
  };
}
