import { useEffect, useMemo, useState } from 'react';
import type { ReturnedOrderItemRecord, ReturnedOrderRecord } from '../types';
import type { ReturnedProduct } from '../../../../../../services/returnedProductService';
import { returnedProductsGateway } from '../gateway';
import { asyncState, type AsyncState } from '../../../../../../shared/contracts/ui.contracts';

interface UseReturnedProductsDataArgs {
  orders?: ReturnedOrderRecord[];
  propOrderItems?: ReturnedOrderItemRecord[];
}

export function useReturnedProductsData({ orders, propOrderItems }: UseReturnedProductsDataArgs) {
  const [returns, setReturns] = useState<ReturnedProduct[]>([]);
  const [queryState, setQueryState] = useState<AsyncState<ReturnedProduct[]>>(asyncState.loading());
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
    const unsub = returnedProductsGateway.subscribeReturns((rows) => {
      setReturns(rows);
      setQueryState(rows.length === 0 ? asyncState.empty() : asyncState.success(rows));
    }, (error) => setQueryState(asyncState.error(error, 'RETURNED_PRODUCTS_LOAD_FAILED')));
    return () => unsub?.();
  }, []);

  const allOrders = useMemo(() => (orders && orders.length > 0 ? orders : internalOrders), [orders, internalOrders]);
  const allOrderItems = useMemo(
    () => (propOrderItems && propOrderItems.length > 0 ? propOrderItems : internalOrderItems),
    [propOrderItems, internalOrderItems]
  );

  return {
    returns,
    setReturns,
    loading: queryState.status === 'loading',
    queryState,
    allOrders,
    allOrderItems,
  };
}
