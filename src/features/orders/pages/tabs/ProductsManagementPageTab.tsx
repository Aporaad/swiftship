/**
 * ProductsManagementPageTab.tsx
 * تبويب/صفحة إدارة المنتجات
 * Products Management Page Tab
 */

import React from 'react';
import ProductsManagementTab from '../../../../components/orders/ProductsManagementTab';

export const ProductsManagementPageTab: React.FC<React.ComponentProps<typeof ProductsManagementTab>> = (props) => {
  return <ProductsManagementTab {...props} />;
};

export default ProductsManagementPageTab;
