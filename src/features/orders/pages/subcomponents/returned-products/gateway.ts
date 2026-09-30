import { addDoc, collection, db, deleteDoc, doc, onSnapshot, updateDoc } from '../../../../../lib/supabase';

export const returnedProductsGateway = {
  subscribeOrders(onData: (rows: any[]) => void) {
    return onSnapshot(collection(db, 'orders'), (snap: any) => {
      onData(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
  },
  subscribeOrderItems(onData: (rows: any[]) => void) {
    return onSnapshot(collection(db, 'order_items'), (snap: any) => {
      onData(snap.docs.map((d: any) => ({ items_id: d.id, ...d.data() })));
    });
  },
  subscribeReturns(onData: (rows: any[]) => void, onError: () => void) {
    return onSnapshot(collection(db, 'returned_products'), (snap: any) => {
      onData(snap.docs.map((d: any) => ({ return_id: d.id, ...d.data() })));
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
