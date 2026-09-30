/**
 * PrintDesignerPageTab.tsx
 * تبويب/صفحة مصمم ومعدّل قوالب الطباعة
 * Print Layout & Document Designer Page Tab
 */

import React from 'react';
import { PrintTemplateDesignerTab } from '../../components/PrintTemplateDesignerTab';
import type { PrintTemplateSettings } from '../../types/reports.types';

interface PrintDesignerPageTabProps {
  isAr: boolean;
  printSettings: PrintTemplateSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintTemplateSettings>>;
  savingTemplate: boolean;
  handleSavePrintSettings: () => void;
  handleResetPrintSettings: () => void;
}

export const PrintDesignerPageTab: React.FC<PrintDesignerPageTabProps> = (props) => {
  return <PrintTemplateDesignerTab {...props} />;
};

export default PrintDesignerPageTab;
