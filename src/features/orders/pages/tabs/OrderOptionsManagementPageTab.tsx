/**
 * OrderOptionsManagementPageTab.tsx
 * تبويب/صفحة إعدادات وخيارات الطلبات
 * Order Options Management Page Tab
 */

import React from 'react';
import OrderOptionsManagementTab from '../../../../components/orders/OrderOptionsManagementTab';

export const OrderOptionsManagementPageTab: React.FC<React.ComponentProps<typeof OrderOptionsManagementTab>> = (props) => {
  return <OrderOptionsManagementTab {...props} />;
};

export default OrderOptionsManagementPageTab;
