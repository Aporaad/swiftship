import { useMemo } from 'react';
import { accountingHierarchyService } from '../../services/accountingHierarchyService';
import { financialAccountService } from '../../services/financialAccountService';
type FinanceScalar = string | number | boolean | null | undefined;

export interface FinanceAccountRow {
  id?: string; category?: string; status?: string; cost?: FinanceScalar; currency?: string;
  accountCode?: string; accountName?: string; nameAr?: string; nameEn?: string;
  entityType?: string; entityName?: string; parentCode?: string; balance?: FinanceScalar;
  [key: string]: unknown;
}

export interface FinanceTransactionRow {
  id?: string; entryId?: string; journalEntryId?: string; type?: string; refNumber?: FinanceScalar;
  journalEntryNumber?: FinanceScalar; currencyOriginal?: string; currency?: string;
  createdAt?: string | number | Date; amount?: FinanceScalar; amountOriginal?: FinanceScalar;
  accountId?: string; accountCode?: string; entityType?: string; entityId?: string;
  entityName?: string; party?: string; description?: string; module?: string;
  createdByUid?: string; createdByName?: string; [key: string]: unknown;
}

export interface FinanceEntryRow extends FinanceTransactionRow { postingStatus?: string; entryNumber?: string; }
export interface FinanceCourierRow { id?: string; accountId?: string | null; courierType?: string | null; financialCurrency?: string | null; }
export interface FinanceSettings { currency?: string; }
interface LedgerGroup { debitLeg?: FinanceTransactionRow; creditLeg?: FinanceTransactionRow; legs: FinanceTransactionRow[]; }
interface LedgerEntry {
  id: string; groupKey: string; journalEntryId: string | null; refNumber: string; date: Date;
  title: string; notes: string; party?: string; debitLeg?: FinanceTransactionRow; creditLeg?: FinanceTransactionRow;
  debitPartyName: string; creditPartyName: string; debitAccountId: string; creditAccountId: string;
  debitAccountCode: string; creditAccountCode: string; isDoubleEntry: boolean; type: 'Debit' | 'Credit' | 'Double';
  amount: number; currency: string; amountOriginal: number; currencyOriginal: string; module: string;
  createdByUid: string; createdByName: string; isSourcing: boolean; allLegs: FinanceTransactionRow[]; runningBalance?: number;
}
function numberValue(value: FinanceScalar): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}


export interface FinanceAccountingSelectorsInput {
  assets: FinanceAccountRow[];
  financialAccounts: FinanceAccountRow[];
  accountTransactions: FinanceTransactionRow[];
  financialEntries: FinanceEntryRow[];
  couriers: FinanceCourierRow[];
  isAr: boolean;
  settings: FinanceSettings;
  dbRates: Record<string, number>;
  searchLedgerQuery: string;
  typeFilter: string;
  currencyFilter: string;
  dateFilter: string;
  customStartDate: string;
  customEndDate: string;
  moduleFilter: string;
  accountTypeFilter: string;
  searchAccountQuery: string;
}

export function useFinanceAccountingSelectors({
  assets,
  financialAccounts,
  accountTransactions,
  financialEntries,
  couriers,
  isAr,
  settings,
  dbRates,
  searchLedgerQuery,
  typeFilter,
  currencyFilter,
  dateFilter,
  customStartDate,
  customEndDate,
  moduleFilter,
  accountTypeFilter,
  searchAccountQuery,
}: FinanceAccountingSelectorsInput) {
  const convertToYER = (amount: number, currency: string = 'YER') => {
    const amt = parseFloat(String(amount || 0));
    if (!currency || currency === 'YER') return amt;
    const rate = dbRates[currency] || 1;
    return amt * rate;
  };

  // Asset totals sums based on the existing converter structure
  const vehiclesTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Vehicles' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(numberValue(a.cost), a.currency || 'YER'), 0);
  }, [assets, settings]);

  const scannersTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Inspection' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(numberValue(a.cost), a.currency || 'YER'), 0);
  }, [assets, settings]);

  const officeAssetsTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Office' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(numberValue(a.cost), a.currency || 'YER'), 0);
  }, [assets, settings]);

  // 1. Double-Entry General Chronology Ledger from the new financial tables.
  const ledgerEntries = useMemo(() => {
    const groupedMap = new Map<string, LedgerGroup>();

    // Group account_trans legs by entryId and keep posted, non-temporary main_entry heads only.
    const entryById = new Map(financialEntries.map((entry) => [entry.id, entry]));
    accountTransactions
      .map((tx) => {
        const entry = entryById.get(tx.entryId || '');
        return { ...tx, entry, journalEntryId: tx.entryId, refNumber: tx.refNumber || entry?.entryNumber, journalEntryNumber: entry?.entryNumber, currencyOriginal: tx.currencyOriginal || entry?.currencyOriginal };
      })
      .filter((tx) => tx.entry?.postingStatus === 'posted')

      .forEach(tx => {
      const groupKey = tx.entryId || (tx.refNumber ? `REF-${String(tx.refNumber)}` : tx.id || 'unknown');
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, { legs: [] });
      }
      const group = groupedMap.get(groupKey)!;
      group.legs.push(tx);
      if (tx.type === 'Debit' && !group.debitLeg) {
        group.debitLeg = tx;
      } else if (tx.type === 'Credit' && !group.creditLeg) {
        group.creditLeg = tx;
      }
    });

    const entries: LedgerEntry[] = [];

    // Process grouped transactions into single consolidated voucher objects
    groupedMap.forEach((group, groupKey) => {
      const debitLeg = group.debitLeg || group.legs.find(l => l.type === 'Debit');
      const creditLeg = group.creditLeg || group.legs.find(l => l.type === 'Credit');
      const sample = debitLeg || creditLeg || group.legs[0];
      const date = new Date(new Date(sample.createdAt || Date.now()));

      const debitAcc = debitLeg ? financialAccounts.find(a => a.id === debitLeg.accountId) : null;
      const creditAcc = creditLeg ? financialAccounts.find(a => a.id === creditLeg.accountId) : null;

      const isSourcing = sample.entityType === 'courier' && (() => {
        const c = couriers.find(currCourier => currCourier.id === sample.entityId || currCourier.accountId === sample.accountId);
        return c?.courierType === 'sourcing' || c?.financialCurrency === 'SAR';
      })() || sample.currencyOriginal === 'SAR' || debitAcc?.currency === 'SAR' || creditAcc?.currency === 'SAR';

      const accountCurrency = sample.currencyOriginal || sample.currency || (debitAcc?.currency || creditAcc?.currency) || (isSourcing ? 'SAR' : (settings.currency || 'YER'));
      const amountOriginal = sample.amountOriginal !== undefined ? sample.amountOriginal : sample.amount;
      const convertedAmt = convertToYER(numberValue(amountOriginal), accountCurrency);

      const debitPartyName = debitLeg
        ? `${debitLeg.accountCode || (debitAcc ? debitAcc.accountCode : '')} - ${debitLeg.entityName || (debitAcc ? (isAr ? debitAcc.nameAr : debitAcc.nameEn) : '')}`.replace(/^- /, '').trim()
        : '—';

      const creditPartyName = creditLeg
        ? `${creditLeg.accountCode || (creditAcc ? creditAcc.accountCode : '')} - ${creditLeg.entityName || (creditAcc ? (isAr ? creditAcc.nameAr : creditAcc.nameEn) : '')}`.replace(/^- /, '').trim()
        : '—';

      entries.push({
        id: sample.id || groupKey,
        groupKey,
        journalEntryId: sample.journalEntryId || null,
        refNumber: String(sample.refNumber ?? sample.journalEntryNumber ?? 'TX-REF'),
        date,
        title: String(sample.description || (debitLeg && creditLeg ? `${debitLeg.entityName || ''} ➔ ${creditLeg.entityName || ''}` : (sample.party || sample.entityName || ''))),
        notes: sample.description || '',
        debitLeg,
        creditLeg,
        debitPartyName,
        creditPartyName,
        debitAccountId: debitLeg?.accountId || '',
        creditAccountId: creditLeg?.accountId || '',
        debitAccountCode: debitLeg?.accountCode || debitAcc?.accountCode || '',
        creditAccountCode: creditLeg?.accountCode || creditAcc?.accountCode || '',
        isDoubleEntry: !!(debitLeg && creditLeg),
        type: debitLeg && !creditLeg ? 'Debit' : (!debitLeg && creditLeg ? 'Credit' : 'Double'),
        amount: convertedAmt,
        currency: settings.currency || 'YER',
        amountOriginal: numberValue(amountOriginal),
        currencyOriginal: accountCurrency,
        module: sample.module || 'adjustment',
        createdByUid: sample.createdByUid || '',
        createdByName: sample.createdByName || '',
        isSourcing,
        allLegs: group.legs
      });
    });

    // Sort chronologically (oldest to newest for correct running balances, then reverse for display)
    const sorted = entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let currentBalance = 0;
    const computed = sorted.map(entry => {
      if (entry.type === 'Debit') {
        currentBalance += entry.amount;
      } else if (entry.type === 'Credit') {
        currentBalance -= entry.amount;
      }
      return {
        ...entry,
        runningBalance: currentBalance
      };
    });

    // Return reversed (newest first for feed view)
    return computed.reverse();
  }, [accountTransactions, financialEntries, isAr, settings, financialAccounts, couriers]);

  // Apply filters to ledger
  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      // 1. Text Search
      const qr = searchLedgerQuery.toLowerCase();
      if (qr) {
        const matchesText = (
          String(e.refNumber || '').toLowerCase().includes(qr) ||
          String(e.title || '').toLowerCase().includes(qr) ||
          String(e.debitPartyName || '').toLowerCase().includes(qr) ||
          String(e.creditPartyName || '').toLowerCase().includes(qr) ||
          String(e.party || '').toLowerCase().includes(qr) ||
          String(e.notes || '').toLowerCase().includes(qr)
        );
        if (!matchesText) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'Debit' && !e.debitLeg && e.type !== 'Debit') return false;
        if (typeFilter === 'Credit' && !e.creditLeg && e.type !== 'Credit') return false;
      }

      // 3. Currency original Filter
      if (currencyFilter !== 'all' && e.currencyOriginal !== currencyFilter) return false;

      // 4. Date range filter
      if (dateFilter !== 'all') {
        const entryTime = e.date.getTime();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          if (entryTime < now.getTime() || entryTime > endOfToday.getTime()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          if (entryTime < sevenDaysAgo.getTime()) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          if (entryTime < thirtyDaysAgo.getTime()) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (entryTime < start.getTime()) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (entryTime > end.getTime()) return false;
          }
        }
      }

      // 5. Module Filter
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;

      return true;
    });
  }, [ledgerEntries, searchLedgerQuery, typeFilter, currencyFilter, dateFilter, customStartDate, customEndDate, moduleFilter]);

  // Filter financial accounts list based on search and type filters
  const filteredAccountsList = useMemo(() => {
    return accountingHierarchyService.filterPostingAccounts(financialAccounts).filter(acc => {
      // 1. Filter by entity type
      if (accountTypeFilter !== 'all' && acc.entityType !== accountTypeFilter) return false;

      // 2. Filter by search query
      const query = searchAccountQuery.trim().toLowerCase();
      if (query) {
        const matchesQuery =
          (acc.accountCode || '').toLowerCase().includes(query) ||
          (acc.entityName || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [financialAccounts, accountTypeFilter, searchAccountQuery]);

  // Dynamic Multi-Currency Cash Box Vault Balances
  const vaultBalances = useMemo(() => {
    // 1. Identify all accounts under "Cash & Safes" category (Code 1110)
    const cashAccounts = accountingHierarchyService.filterPostingAccounts(financialAccounts).filter(a =>
      a.accountCode === '1110' ||
      a.parentCode === '1110' ||
      a.accountCode?.startsWith('111')
    );

    // 2. Calculate actual YER balance from all YER-denominated cash accounts
    const yerCashAccounts = cashAccounts.filter(a => a.currency === 'YER');
    const totalYerBalance = yerCashAccounts.reduce((sum, a) => sum + (parseFloat(String(a.balance ?? 0)) || 0), 0);

    // 3. Foreign Currencies Card: Show the equivalent value of the YER treasury in USD and SAR as requested
    const usdEquivalent = totalYerBalance / (dbRates.USD || 1);
    const sarEquivalent = totalYerBalance / (dbRates.SAR || 1);

    return {
      yer: { in: 0, out: 0, balance: totalYerBalance },
      usd: { in: 0, out: 0, balance: usdEquivalent },
      sar: { in: 0, out: 0, balance: sarEquivalent },
      totalIn_YER: totalYerBalance,
      totalOut_YER: 0
    };
  }, [financialAccounts, settings]);

  // Dynamic P&L Trial Balance Summary metrics — all values in YER for consistent financial scope
  // These metrics directly feed from the ChartOfAccounts' system account balances.
  const financialTrialMetrics = useMemo(() => {
    // Revenues: Sum of all accounts starting with 4 (Revenues)
    const totalCustomerRevenue = financialAccounts
      .filter(a => a.accountCode?.startsWith('4') || a.accountCode?.startsWith('REV'))
      .reduce((sum, a) => {
        const balance = parseFloat(String(a.balance ?? 0)) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 4200: Manual debit (inflow) adjustments ──────────────────────────
    const totalAdjustInflows = 0; // Handled implicitly in account balances

    // ── 5000: Operating costs derived from posted ledger entries ─────────
    // Sum of all accounts starting with 5 (Expenses)
    const netOperatingCosts = financialAccounts
      .filter(a => a.accountCode?.startsWith('5') || a.accountCode?.startsWith('EXP'))
      .reduce((sum, a) => {
        const balance = parseFloat(String(a.balance ?? 0)) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 1130: Receivables = sum of customer balances ─────────────────────
    const netReceivables = financialAccounts
      .filter(a => a.entityType === 'customer' || a.accountCode?.startsWith('1130'))
      .reduce((sum, a) => {
        const balance = parseFloat(String(a.balance ?? 0)) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 2110: Active custody liabilities ─────────────────────────────────
    const activeCustodyLiabilities = financialAccounts
      .filter(a => a.entityType === 'courier' || a.accountCode?.startsWith('2120'))
      .reduce((sum, a) => {
        const balance = parseFloat(String(a.balance ?? 0)) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 3200: Net Profit = Revenue - Costs ───────────────────────────────
    const netProfit = totalCustomerRevenue - netOperatingCosts;

    const operatingMargin = totalCustomerRevenue > 0
      ? parseFloat(((netProfit / totalCustomerRevenue) * 100).toFixed(2))
      : 0;

    return {
      totalCustomerRevenue,
      totalAdjustInflows,
      netOperatingCosts,
      activeCustodyLiabilities,
      netReceivables,
      netProfit,
      operatingMargin
    };
  }, [financialAccounts]);

  return {
    vehiclesTotal,
    scannersTotal,
    officeAssetsTotal,
    ledgerEntries,
    filteredLedgerEntries,
    filteredAccountsList,
    vaultBalances,
    financialTrialMetrics,
  };
}
