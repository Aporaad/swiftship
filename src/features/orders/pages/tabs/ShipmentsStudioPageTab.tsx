/**
 * ShipmentsStudioPageTab.tsx
 * تبويب/صفحة أستوديو الشحنات
 * Shipments Studio Page Tab
 */

import React from 'react';
import { ShipmentsStudioTab } from '../../../../components/orders/ShipmentsStudioTab';

export const ShipmentsStudioPageTab: React.FC<React.ComponentProps<typeof ShipmentsStudioTab>> = (props) => {
  return <ShipmentsStudioTab {...props} />;
};

export default ShipmentsStudioPageTab;
