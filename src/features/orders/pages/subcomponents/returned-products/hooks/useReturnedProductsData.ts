import { useEffect, useMemo, useState } from 'react';
import type { ReturnedOrderItemRecord, ReturnedOrderRecord } from '../types';
import type { ReturnedProduct } from '../../../../../../services/returnedProductService';
import { returnedProductsGateway } from '../gateway';

interface UseReturnedProductsDataArgs {
  orders?: ReturnedOrderRecord[];
  propOrderItems?: ReturnedOrderItemRecord[];
}

export function useReturnedProductsData({ orders, propOrderItems }: UseReturnedProductsDataArgs) {
  const [returns, setReturns] = useState<ReturnedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalOrders, setInternalOrders] = useState<ReturnedOrderRecord[]>([]);
  const [internalOrderItems, setInternalOrderItems] = useState<ReturnedOrderItemRecord[]>([]);

  useEffect(() => {
    if (!orders || orders.length === 0) {
      const unsub = returnedProductsGateway.subscribeOrders(setInternalOrders);
      return () => unsub?.();
    }
  }, [orders]);

  useEffect(() => {
    if (!propOrderItems || propOrderItems.length === 0) {
      const unsub = returnedProductsGateway.subscribeOrderItems(setInternalOrderItems);
      return () => unsub?.();
    }
  }, [propOrderItems]);

  useEffect(() => {
    const unsub = returnedProductsGateway.subscribeReturns(setReturns, () => setLoading(false));
    return () => unsub?.();
  }, []);

  const allOrders = useMemo(() => (orders && orders.length > 0 ? orders : internalOrders), [orders, internalOrders]);
  const allOrderItems = useMemo(
    () => (propOrderItems && propOrderItems.length > 0 ? propOrderItems : internalOrderItems),
    [propOrderItems, internalOrderItems]
  );

  return { returns, setReturns, loading, allOrders, allOrderItems };
}
