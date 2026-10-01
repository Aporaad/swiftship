import { useEffect, useState } from 'react';
import { financeAccountingDataGateway } from './FinanceAccountingDataGateway';

export interface FinanceAccountingData {
  assets: any[];
  financialAccounts: any[];
  custodyAdvances: any[];
  accountTransactions: any[];
  financialEntries: any[];
  salaryHistory: any[];
  employees: any[];
}

export function useFinanceAccountingData(): FinanceAccountingData {
  const [assets, setAssets] = useState<any[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [custodyAdvances, setCustodyAdvances] = useState<any[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [financialEntries, setFinancialEntries] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => financeAccountingDataGateway.subscribeCollection(
    'assets',
    setAssets,
    (error) => console.error('Error loading assets for balance list:', error),
  ), []);

  useEffect(() => financeAccountingDataGateway.subscribeCollection(
    'accounts',
    setFinancialAccounts,
    (error) => console.error('Error loading financial accounts:', error),
  ), []);

  useEffect(() => financeAccountingDataGateway.subscribeCollection(
    'custody_advances',
    setCustodyAdvances,
    (error) => console.error('Error loading custody advances:', error),
  ), []);

  useEffect(() => {
    const unsubEntries = financeAccountingDataGateway.subscribeCollection(
      'main_entry',
      setFinancialEntries,
      (error) => console.error('Error loading main_entry:', error),
    );
    const unsub = financeAccountingDataGateway.subscribeCollection(
      'account_trans',
      (rows) => setAccountTransactions(rows.map((row) => ({
        ...row,
        type: row.type || row.transType,
        amount: row.amount ?? row.amountOriginal,
        amountOriginal: row.amountOriginal,
        entryId: row.entryId,
      }))),
      (error) => console.error('Error loading account_trans:', error),
    );
    return () => { unsubEntries(); unsub(); };
  }, []);

  useEffect(() => {
    const unsubH = financeAccountingDataGateway.subscribeOrderedCollection(
      'salary_history',
      'createdAt',
      setSalaryHistory,
      (error) => console.error('[SalaryTab] salary_history error:', error),
    );
    const unsubE = financeAccountingDataGateway.subscribeCollection(
      'users',
      setEmployees,
      (error) => console.error('[SalaryTab] users error:', error),
    );
    return () => { unsubH(); unsubE(); };
  }, []);

  return { assets, financialAccounts, custodyAdvances, accountTransactions, financialEntries, salaryHistory, employees };
}
