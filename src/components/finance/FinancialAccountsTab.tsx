import React from 'react';
import { PlusCircle, Search } from 'lucide-react';
import { financialAccountService } from '../../services/financialAccountService';
import type { AccountTypeFilter } from '../financeAccounting/FinanceAccountingTypes';

interface FinancialAccountsTabProps {
  isAr: boolean;
  accountTypeFilter: AccountTypeFilter;
  setAccountTypeFilter: React.Dispatch<React.SetStateAction<AccountTypeFilter>>;
  searchAccountQuery: string;
  setSearchAccountQuery: React.Dispatch<React.SetStateAction<string>>;
  financialAccounts: any[];
  filteredAccountsList: any[];
  dbRates: Record<string, number>;
  setAdjustData: React.Dispatch<React.SetStateAction<any>>;
  setTargetType: React.Dispatch<React.SetStateAction<string>>;
  setSourceAccountId: React.Dispatch<React.SetStateAction<string>>;
  setTargetAccountId: React.Dispatch<React.SetStateAction<string>>;
  setIsAdjustmentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAuditedCustomerId: React.Dispatch<React.SetStateAction<string>>;
  setAuditedCourierId: React.Dispatch<React.SetStateAction<string>>;
  setAccountingTab: React.Dispatch<React.SetStateAction<string>>;
}

export default function FinancialAccountsTab({
  isAr,
  accountTypeFilter,
  setAccountTypeFilter,
  searchAccountQuery,
  setSearchAccountQuery,
  financialAccounts,
  filteredAccountsList,
  dbRates,
  setAdjustData,
  setTargetType,
  setSourceAccountId,
  setTargetAccountId,
  setIsAdjustmentModalOpen,
  setAuditedCustomerId,
  setAuditedCourierId,
  setAccountingTab,
}: FinancialAccountsTabProps) {
  return (
        <div className="space-y-6">
          {/* Dashboard Header & Quick Actions */}
          <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                  {isAr ? 'لوحة التحكم بالحسابات المالية' : 'Financial Accounts Dashboard'}
                </h3>
                <p className="text-[10px] text-slate-550 font-medium">
                  {isAr
                    ? 'إدارة ومطابقة أرصدة حسابات العملاء، المناديب، والموظفين مباشرة مع التحويل الفوري للعملات.'
                    : 'Manage and reconcile balances for customers, couriers, and staff with real-time exchange rates.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAdjustData({
                      type: 'Debit',
                      amount: '',
                      currency: 'YER',
                      title: '',
                      recipientName: '',
                      notes: ''
                    });
                    setTargetType('general');
                    setSourceAccountId('');
                    setTargetAccountId('');
                    setIsAdjustmentModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/35 text-[#d4af37] px-4 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  {isAr ? 'قيد تسوية جديد' : 'New Journal Entry'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-slate-900">
              {/* Entity Type Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">
                  {isAr ? 'تصنيف الحساب المالي' : 'Account Category'}
                </label>
                <select
                  value={accountTypeFilter}
                  onChange={e => setAccountTypeFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع الحسابات' : 'All Accounts'}</option>
                  <option value="customer">{isAr ? 'حسابات العملاء (1130)' : 'Customer Accounts'}</option>
                  <option value="courier">{isAr ? 'حسابات المناديب (2120)' : 'Courier Accounts'}</option>
                  <option value="employee">{isAr ? 'حسابات الموظفين (2130)' : 'Employee Accounts'}</option>
                  <option value="source">{isAr ? 'حسابات مصادر الطلبات (2140)' : 'Order Source Accounts'}</option>
                  <option value="shipping_company">{isAr ? 'حسابات شركات الشحن (2150)' : 'Shipping Company Accounts'}</option>
                  <option value="asset">{isAr ? 'حسابات الأصول الثابتة (12xx)' : 'Fixed Asset Accounts'}</option>
                </select>
              </div>

              {/* Text Search */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">
                  {isAr ? 'البحث بالاسم أو رمز الحساب' : 'Search name or account code'}
                </label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3 h-3" />
                  <input
                    type="text"
                    value={searchAccountQuery}
                    onChange={e => setSearchAccountQuery(e.target.value)}
                    placeholder={isAr ? "بحث..." : "Search..."}
                    className="w-full pr-8 pl-3 py-1.5 bg-black/40 border border-slate-850 text-white rounded-lg text-xs font-semibold outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="flex items-center justify-around bg-black/35 rounded-xl border border-slate-850 px-2">
                <div className="text-center">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي العملاء' : 'Cust Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-white block">
                    {financialAccounts.filter(a => a.entityType === 'customer').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center border-l border-r border-slate-850 px-3">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي المناديب' : 'Courier Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-amber-500 block">
                    {financialAccounts.filter(a => a.entityType === 'courier').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي الموظفين' : 'Staff Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-indigo-400 block">
                    {financialAccounts.filter(a => a.entityType === 'employee').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts List Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[9.5px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'رمز الحساب' : 'Account Code'}</th>
                    <th className="p-4">{isAr ? 'الاسم المستهدف' : 'Name'}</th>
                    <th className="p-4">{isAr ? 'نوع الحساب' : 'Type'}</th>
                    <th className="p-4">{isAr ? 'الراتب الشهري' : 'Monthly Salary'}</th>
                    <th className="p-4">{isAr ? 'العملة الافتراضية' : 'Currency'}</th>
                    <th className="p-4">{isAr ? 'الرصيد باليمني' : 'YER Balance'}</th>
                    <th className="p-4">{isAr ? 'المعادل بالدولار' : 'USD Balance'}</th>
                    <th className="p-4">{isAr ? 'المعادل بالسعودي' : 'SAR Balance'}</th>
                    <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-805 bg-black/10 font-bold">
                  {filteredAccountsList.map((acc, idx) => {
                    const balanceInUSD = financialAccountService.convertToTargetCurrency(acc.balance || 0, acc.currency || 'YER', 'USD', dbRates);
                    const balanceInSAR = financialAccountService.convertToTargetCurrency(acc.balance || 0, acc.currency || 'YER', 'SAR', dbRates);

                    return (
                      <tr key={`${acc.id}-${idx}`} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-4">
                          <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2.5 py-1 rounded-lg text-[9.5px] font-mono">
                            {acc.accountCode}
                          </span>
                        </td>
                        <td className="p-4 text-white text-xs font-black">
                          <span
                            onClick={() => {
                              if (acc.entityId && (acc.entityType === 'customer' || acc.entityType === 'courier')) {
                                window.dispatchEvent(new CustomEvent('open-entity-ledger', {
                                  detail: { entityId: acc.entityId, entityType: acc.entityType }
                                }));
                              }
                            }}
                            className={
                              acc.entityId && (acc.entityType === 'customer' || acc.entityType === 'courier')
                                ? 'hover:text-[#d4af37] cursor-pointer underline decoration-dotted decoration-[#d4af37]/40 transition-colors'
                                : ''
                            }
                          >
                            {acc.entityName}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded ${acc.entityType === 'customer' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                            acc.entityType === 'courier' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/20' :
                              'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/10'
                            }`}>
                            {isAr
                              ? (acc.entityType === 'customer' ? 'عميل' : acc.entityType === 'courier' ? 'مندوب' : 'موظف')
                              : acc.entityType
                            }
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-300">
                          {acc.entityType === 'employee' && acc.monthlySalary !== undefined ? (
                            <span className="text-[#d4af37] font-black">
                              {acc.monthlySalary.toLocaleString()} {acc.currency}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 font-mono">
                          {acc.currency}
                        </td>
                        <td className={`p-4 font-mono font-black ${(acc.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
                          }`}>
                          {acc.currency && acc.currency !== 'YER' ? (
                            <div>
                              <span>
                                {acc.currency === 'SAR' ? 'SR' : acc.currency === 'USD' ? '$' : acc.currency} {
                                  (acc.currency === 'SAR' ? balanceInSAR : balanceInUSD).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                }
                              </span>
                              <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                (≈ {acc.balance?.toLocaleString()} YER)
                              </span>
                            </div>
                          ) : (
                            <span>{acc.balance?.toLocaleString()} YER</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-350 font-mono">
                          ${balanceInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-slate-350 font-mono">
                          SR {balanceInSAR.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => {
                              setAdjustData({
                                type: 'Debit',
                                amount: '',
                                currency: 'YER',
                                title: isAr ? 'تسوية حساب مالي' : 'Reconciliation of Account',
                                recipientName: acc.entityName,
                                notes: ''
                              });
                              setTargetType(acc.entityType);
                              setSourceAccountId('');
                              setTargetAccountId(acc.id);
                              setIsAdjustmentModalOpen(true);
                            }}
                            className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-2 py-1 rounded-lg text-[10px] transition-all"
                          >
                            {isAr ? 'تسوية' : 'Reconcile'}
                          </button>

                          {acc.entityType === 'customer' && (
                            <button
                              onClick={() => {
                                setAuditedCustomerId(acc.entityId);
                                setAccountingTab('customer_audit');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px] transition-all"
                            >
                              {isAr ? 'كشف الحساب' : 'Statement'}
                            </button>
                          )}

                          {acc.entityType === 'courier' && (
                            <button
                              onClick={() => {
                                setAuditedCourierId(acc.entityId);
                                setAccountingTab('courier_audit');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px] transition-all"
                            >
                              {isAr ? 'كشف العهد' : 'Statement'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAccountsList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                        [ {isAr ? 'لا توجد حسابات مالية مطابقة' : 'no_financial_accounts_found'} ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
  );
}
