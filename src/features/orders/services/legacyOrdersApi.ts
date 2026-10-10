import type { OrdersFeatureApi } from "../api";
import { ordersApiDataGateway } from "./ordersApiDataGateway";

/**
 * @deprecated Kept temporarily for callers using the historical export name.
 * Every operation is delegated to the HTTP API gateway; no legacy fallback remains.
 */
export const legacyOrdersApi: OrdersFeatureApi = ordersApiDataGateway;

/** @deprecated Prefer importing ordersApiDataGateway directly. */
export const createLegacyOrdersApi = (): OrdersFeatureApi =>
  ordersApiDataGateway;

export default ordersApiDataGateway;
