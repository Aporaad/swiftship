/**
 * OrdersDeckPageTab.tsx
 * تبويب/صفحة جدول الطلبات الرئيسي
 * Main Orders Table Deck Page Tab
 */

import React from 'react';
import { OrdersTableDeck } from '../../../../components/orders/OrdersTableDeck';

export const OrdersDeckPageTab: React.FC<React.ComponentProps<typeof OrdersTableDeck>> = (props) => {
  return <OrdersTableDeck {...props} />;
};

export default OrdersDeckPageTab;
