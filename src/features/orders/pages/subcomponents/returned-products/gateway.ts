import { addDoc, collection, db, deleteDoc, doc, onSnapshot, updateDoc } from '../../../../../data/legacy/legacy-compat.ts';
import type { ReturnedProduct } from '../../../../../services/returnedProductService';

type SnapshotDocument = { id: string; data: () => Record<string, unknown> };
type CollectionSnapshot = { docs: SnapshotDocument[] };
type OrderRow = { id: string } & Record<string, unknown>;
type OrderItemRow = { items_id: string } & Record<string, unknown>;

const toReturnedProduct = (document: SnapshotDocument): ReturnedProduct => ({
  ...document.data(),
  return_id: document.id,
});

export const returnedProductsGateway = {
  subscribeOrders(onData: (rows: OrderRow[]) => void) {
    return onSnapshot(collection(db, 'orders'), (snap: CollectionSnapshot) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  },
  subscribeOrderItems(onData: (rows: OrderItemRow[]) => void) {
    return onSnapshot(collection(db, 'order_items'), (snap: CollectionSnapshot) => {
      onData(snap.docs.map((d) => ({ items_id: d.id, ...d.data() })));
    });
  },
  subscribeReturns(onData: (rows: ReturnedProduct[]) => void, onError: (error: unknown) => void) {
    return onSnapshot(collection(db, 'returned_products'), (snap: CollectionSnapshot) => {
      onData(snap.docs.map(toReturnedProduct));
    }, onError);
  },
  updateReturn(returnId: string, payload: Record<string, unknown>) {
    return updateDoc(doc(db, 'returned_products', returnId), payload);
  },
  createReturn(returnId: string, payload: Record<string, unknown>) {
    return addDoc(returnId, collection(db, 'returned_products'), payload);
  },
  updateOrderItem(orderItemId: string, payload: Record<string, unknown>) {
    return updateDoc(doc(db, 'order_items', orderItemId), payload);
  },
  deleteReturn(returnId: string) {
    return deleteDoc(doc(db, 'returned_products', returnId));
  },
};
