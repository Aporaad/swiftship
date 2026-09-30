import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  OperationType,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "../../../lib/supabase";
import {
  ORDER_COLLECTIONS,
  ORDER_DOCUMENTS,
} from "../constants/orders.constants";
import type {
  OrdersCollectionRepository,
  OrdersCollectionSnapshot,
  OrdersDocumentRepository,
  OrdersEntityRecord,
  OrdersErrorHandler,
  OrdersFeatureApi,
  OrdersFeatureCollections,
  OrdersFeatureCommands,
  OrdersWritePayload,
} from "../api";
import type { OrderFeatureRecord, ShipmentFeatureRecord } from "../types";
import type {
  OrderCreateInput,
  OrderUpdateInput,
} from "../../../data/dtos/orders.dto";

interface LegacySnapshotDocument {
  readonly id: string;
  data(): Record<string, unknown>;
  exists(): boolean;
}

interface LegacyCollectionSnapshot {
  readonly docs: readonly LegacySnapshotDocument[];
}

interface LegacyDocumentSnapshot {
  readonly id: string;
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

interface LegacyDocumentReference {
  readonly id: string;
}

const reportLegacyError = (
  error: unknown,
  _operation: OperationType,
  _path: string,
  onError?: OrdersErrorHandler
): void => {
  // Preserve the caller's existing error semantics; do not introduce logging where
  // the legacy subscription/write path previously had no error callback.
  onError?.(error);
};

const recordFromDocument = <TRecord>(
  document: LegacySnapshotDocument
): TRecord =>
  ({
    id: document.id,
    ...document.data(),
  }) as TRecord;

const recordFromDocSnapshot = <TRecord>(
  snapshot: LegacyDocumentSnapshot
): TRecord | null => {
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() ?? {}) } as TRecord;
};

const toCollectionSnapshot = <TRecord>(
  snapshot: LegacyCollectionSnapshot
): OrdersCollectionSnapshot<TRecord> => ({
  records: snapshot.docs.map(document => recordFromDocument<TRecord>(document)),
});

const collectionReference = (table: string) => collection(db, table);
const documentReference = (table: string, id: string) => doc(db, table, id);

function makeCollectionRepository<
  TRecord,
  TCreate = OrdersWritePayload,
  TUpdate = OrdersWritePayload,
>(
  table: string,
  ordered = false
): OrdersCollectionRepository<TRecord, TCreate, TUpdate> {
  const listReference = () => {
    const reference = collectionReference(table);
    return ordered ? query(reference, orderBy("createdAt", "desc")) : reference;
  };

  return {
    subscribe(onData, onError) {
      return onSnapshot(
        listReference(),
        (snapshot: LegacyCollectionSnapshot) =>
          onData(toCollectionSnapshot<TRecord>(snapshot)),
        (error: unknown) =>
          reportLegacyError(error, OperationType.LIST, table, onError)
      );
    },

    async list() {
      try {
        const snapshot = await getDocs(listReference());
        return toCollectionSnapshot<TRecord>(
          snapshot as LegacyCollectionSnapshot
        ).records;
      } catch (error) {
        reportLegacyError(error, OperationType.LIST, table);
        throw error;
      }
    },

    async get(id) {
      try {
        const snapshot = await getDoc(documentReference(table, id));
        return recordFromDocSnapshot<TRecord>(
          snapshot as LegacyDocumentSnapshot
        );
      } catch (error) {
        reportLegacyError(error, OperationType.GET, `${table}/${id}`);
        throw error;
      }
    },

    async create(id, payload) {
      try {
        const reference = await addDoc(id, collectionReference(table), payload);
        return { id: String((reference as LegacyDocumentReference).id) };
      } catch (error) {
        reportLegacyError(error, OperationType.CREATE, table);
        throw error;
      }
    },

    async set(id, payload) {
      try {
        await setDoc(documentReference(table, id), payload);
      } catch (error) {
        reportLegacyError(error, OperationType.WRITE, `${table}/${id}`);
        throw error;
      }
    },

    async update(id, changes) {
      try {
        await updateDoc(documentReference(table, id), changes);
      } catch (error) {
        reportLegacyError(error, OperationType.UPDATE, `${table}/${id}`);
        throw error;
      }
    },

    async delete(id) {
      try {
        await deleteDoc(documentReference(table, id));
      } catch (error) {
        reportLegacyError(error, OperationType.DELETE, `${table}/${id}`);
        throw error;
      }
    },
  };
}

function makeDocumentRepository<TRecord, TWrite = OrdersWritePayload>(
  table: string,
  id: string
): OrdersDocumentRepository<TRecord, TWrite> {
  const path = `${table}/${id}`;
  const reference = () => documentReference(table, id);

  return {
    subscribe(onData, onError) {
      return onSnapshot(
        reference(),
        (snapshot: LegacyDocumentSnapshot) =>
          onData(recordFromDocSnapshot<TRecord>(snapshot)),
        (error: unknown) =>
          reportLegacyError(error, OperationType.GET, path, onError)
      );
    },

    async get() {
      try {
        const snapshot = await getDoc(reference());
        return recordFromDocSnapshot<TRecord>(
          snapshot as LegacyDocumentSnapshot
        );
      } catch (error) {
        reportLegacyError(error, OperationType.GET, path);
        throw error;
      }
    },

    async set(payload) {
      try {
        await setDoc(reference(), payload);
      } catch (error) {
        reportLegacyError(error, OperationType.WRITE, path);
        throw error;
      }
    },

    async update(changes) {
      try {
        await updateDoc(reference(), changes);
      } catch (error) {
        reportLegacyError(error, OperationType.UPDATE, path);
        throw error;
      }
    },

    async delete() {
      try {
        await deleteDoc(reference());
      } catch (error) {
        reportLegacyError(error, OperationType.DELETE, path);
        throw error;
      }
    },
  };
}

const makeCollections = (): OrdersFeatureCollections => ({
  orders: makeCollectionRepository<
    OrderFeatureRecord,
    OrderCreateInput,
    OrderUpdateInput
  >(ORDER_COLLECTIONS.orders, true),
  customers: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.customers
  ),
  employees: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.employees
  ),
  couriers: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.couriers
  ),
  accounts: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.accounts
  ),
  sources: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.sources
  ),
  shippingCompanies: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.shippingCompanies
  ),
  products: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.products
  ),
  shipments: makeCollectionRepository<ShipmentFeatureRecord>(
    ORDER_COLLECTIONS.shipments
  ),
  orderItems: makeCollectionRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.orderItems
  ),
  settings: makeDocumentRepository<OrdersEntityRecord>(
    ORDER_COLLECTIONS.settings,
    ORDER_DOCUMENTS.automaticVoucherRules
  ),
});

const makeCommands = (): OrdersFeatureCommands => ({
  async createOrderRecord(id, payload) {
    try {
      const reference = await addDoc(
        id,
        collectionReference(ORDER_COLLECTIONS.orders),
        payload
      );
      return { id: String((reference as LegacyDocumentReference).id) };
    } catch (error) {
      reportLegacyError(error, OperationType.CREATE, ORDER_COLLECTIONS.orders);
      throw error;
    }
  },

  async updateOrderRecord(id, changes) {
    try {
      await updateDoc(documentReference(ORDER_COLLECTIONS.orders, id), changes);
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.UPDATE,
        `${ORDER_COLLECTIONS.orders}/${id}`
      );
      throw error;
    }
  },

  async createOrderItem(id, payload) {
    try {
      const reference = await addDoc(
        id,
        collectionReference(ORDER_COLLECTIONS.orderItems),
        payload
      );
      return { id: String((reference as LegacyDocumentReference).id) };
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.CREATE,
        ORDER_COLLECTIONS.orderItems
      );
      throw error;
    }
  },

  async createShipmentRecord(id, payload) {
    try {
      const reference = await addDoc(
        id,
        collectionReference(ORDER_COLLECTIONS.shipments),
        payload
      );
      return { id: String((reference as LegacyDocumentReference).id) };
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.CREATE,
        ORDER_COLLECTIONS.shipments
      );
      throw error;
    }
  },

  async upsertShipment(id, payload) {
    try {
      await setDoc(documentReference(ORDER_COLLECTIONS.shipments, id), payload);
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.WRITE,
        `${ORDER_COLLECTIONS.shipments}/${id}`
      );
      throw error;
    }
  },

  async updateShipment(id, changes) {
    try {
      await updateDoc(
        documentReference(ORDER_COLLECTIONS.shipments, id),
        changes
      );
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.UPDATE,
        `${ORDER_COLLECTIONS.shipments}/${id}`
      );
      throw error;
    }
  },

  async updateShipmentStatus(id, status, updatedAt = Date.now()) {
    try {
      await updateDoc(documentReference(ORDER_COLLECTIONS.shipments, id), {
        shipmentStatus: status,
        updatedAt,
      });
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.UPDATE,
        `${ORDER_COLLECTIONS.shipments}/${id}`
      );
      throw error;
    }
  },

  async deleteShipment(id) {
    try {
      await deleteDoc(documentReference(ORDER_COLLECTIONS.shipments, id));
    } catch (error) {
      reportLegacyError(
        error,
        OperationType.DELETE,
        `${ORDER_COLLECTIONS.shipments}/${id}`
      );
      throw error;
    }
  },

  async findOrdersByNumberPrefix(prefix) {
    try {
      const ordersQuery = query(
        collectionReference(ORDER_COLLECTIONS.orders),
        where("orderNumber", ">=", prefix),
        where("orderNumber", "<=", `${prefix}-\uF8FF`)
      );
      const snapshot = await getDocs(ordersQuery);
      return toCollectionSnapshot<OrderFeatureRecord>(
        snapshot as LegacyCollectionSnapshot
      ).records;
    } catch (error) {
      reportLegacyError(error, OperationType.LIST, ORDER_COLLECTIONS.orders);
      throw error;
    }
  },
});

/** Default Orders adapter: a compatibility wrapper around src/lib/supabase calls. */
export const legacyOrdersApi: OrdersFeatureApi = {
  collections: makeCollections(),
  commands: makeCommands(),
};

export const createLegacyOrdersApi = (): OrdersFeatureApi => ({
  collections: makeCollections(),
  commands: makeCommands(),
});

export default legacyOrdersApi;
