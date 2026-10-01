/**
 * OrderStatusManagementPageTab.tsx
 * تبويب/صفحة حالات ومراحل الطلبات
 * Order Status Stages Management Page Tab
 */

import React from 'react';
import OrderStatusManagementTab from '../../../../components/OrderStatusManagementTab';

export const OrderStatusManagementPageTab: React.FC<React.ComponentProps<typeof OrderStatusManagementTab>> = (props) => {
  return <OrderStatusManagementTab {...props} />;
};

export default OrderStatusManagementPageTab;
