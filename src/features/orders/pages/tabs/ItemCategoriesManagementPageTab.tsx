/**
 * ItemCategoriesManagementPageTab.tsx
 * تبويب/صفحة فئات المنتجات
 * Item Categories Management Page Tab
 */

import React from 'react';
import ItemCategoriesManagementTab from '../../../../components/orders/ItemCategoriesManagementTab';

export const ItemCategoriesManagementPageTab: React.FC<{ isAr: boolean; canManage: boolean }> = (props) => {
  return <ItemCategoriesManagementTab {...props} />;
};

export default ItemCategoriesManagementPageTab;
