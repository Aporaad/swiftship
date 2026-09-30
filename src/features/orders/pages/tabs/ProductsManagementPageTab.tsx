/**
 * ProductsManagementPageTab.tsx
 * تبويب/صفحة إدارة المنتجات
 * Products Management Page Tab
 */

import React from 'react';
import ProductsManagementTab from '../../../../components/orders/ProductsManagementTab';

export const ProductsManagementPageTab: React.FC<any> = (props) => {
  return <ProductsManagementTab {...props} />;
};

export default ProductsManagementPageTab;
