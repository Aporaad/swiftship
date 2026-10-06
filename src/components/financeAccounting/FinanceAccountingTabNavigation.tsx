import React from 'react';
import { FolderTree, Scale, Truck, User, Users, Wallet, Wrench, ReceiptText } from 'lucide-react';
import type { FinanceAccountingTabNavigationProps } from './FinanceAccountingTypes';

export default function FinanceAccountingTabNavigation({ accountingTab, isAr, onTabChange }: FinanceAccountingTabNavigationProps) {
  const tabClass = (tab: string) => `pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === tab
    ? 'border-[#d4af37] text-white'
    : 'border-transparent text-slate-500 hover:text-slate-350'
    }`;

  return (
    <div className="flex flex-wrap border-b border-slate-850 gap-4 mb-2">
      <button onClick={() => onTabChange('general_ledger')} className={tabClass('general_ledger')}>
        <Scale className="w-3.5 h-3.5 animate-pulse" />
        {isAr ? '⚖️ الدفتر اليومي والمقاصة' : 'Daily Double-Entry Ledger'}
      </button>
      <button onClick={() => onTabChange('portal_payment_review')} className={tabClass('portal_payment_review')}>
        <ReceiptText className="w-3.5 h-3.5 text-[#d4af37]" />
        {isAr ? 'طلبات سداد البوابة' : 'Portal Payment Review'}
      </button>
      <button onClick={() => onTabChange('courier_audit')} className={tabClass('courier_audit')}>
        <Truck className="w-3.5 h-3.5" />
        {isAr ? '🔑حسابات المناديب' : 'Courier Custody Statement'}
      </button>
      <button onClick={() => onTabChange('customer_audit')} className={tabClass('customer_audit')}>
        <User className="w-3.5 h-3.5" />
        {isAr ? '👥 حسابات العملاء' : 'Customer Account Audits'}
      </button>
      <button onClick={() => onTabChange('salary_history')} className={tabClass('salary_history')}>
        <Users className="w-3.5 h-3.5 text-[#d4af37]" />
        {isAr ? '💼حسابات الموظفين' : 'Salary History & Staff Statements'}
      </button>
      <button onClick={() => onTabChange('assets_management')} className={tabClass('assets_management')}>
        <Wrench className="w-3.5 h-3.5 text-[#d4af37]" />
        {isAr ? '📦الأصول الثابتة' : 'Assets & Maintenance Portfolio'}
      </button>
      <button onClick={() => onTabChange('chart_of_accounts')} className={tabClass('chart_of_accounts')}>
        <FolderTree className="w-3.5 h-3.5 text-[#d4af37]" />
        {isAr ? '🌳 الشجرة المحاسبية' : 'Chart of Accounts'}
      </button>
      <button onClick={() => onTabChange('financial_accounts')} className={tabClass('financial_accounts')}>
        <Wallet className="w-3.5 h-3.5 text-[#d4af37]" />
        {isAr ? '💳 إدارة الحسابات المالية' : 'Financial Accounts'}
      </button>
    </div>
  );
}
