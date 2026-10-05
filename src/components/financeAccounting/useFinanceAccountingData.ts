import { useEffect, useState } from "react";
import { financeApiDataGateway as financeAccountingDataGateway } from "./FinanceApiDataGateway";
import type {
  FinanceAccountRow,
  FinanceEntryRow,
  FinanceSettings,
  FinanceTransactionRow,
} from "./useFinanceAccountingSelectors";

function toFinanceScalar(
  value: unknown
): string | number | boolean | null | undefined {
  return value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : undefined;
}

export interface FinanceAccountingData {
  assets: FinanceAccountRow[];
  financialAccounts: FinanceAccountRow[];
  custodyAdvances: FinanceTransactionRow[];
  accountTransactions: FinanceTransactionRow[];
  financialEntries: FinanceEntryRow[];
  salaryHistory: FinanceTransactionRow[];
  employees: FinanceAccountRow[];
}

export function useFinanceAccountingData(): FinanceAccountingData {
  const [assets, setAssets] = useState<FinanceAccountRow[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<
    FinanceAccountRow[]
  >([]);
  const [custodyAdvances, setCustodyAdvances] = useState<
    FinanceTransactionRow[]
  >([]);
  const [accountTransactions, setAccountTransactions] = useState<
    FinanceTransactionRow[]
  >([]);
  const [financialEntries, setFinancialEntries] = useState<FinanceEntryRow[]>(
    []
  );
  const [salaryHistory, setSalaryHistory] = useState<FinanceTransactionRow[]>(
    []
  );
  const [employees, setEmployees] = useState<FinanceAccountRow[]>([]);

  useEffect(
    () =>
      financeAccountingDataGateway.subscribeCollection(
        "assets",
        setAssets,
        error => console.error("Error loading assets for balance list:", error)
      ),
    []
  );

  useEffect(
    () =>
      financeAccountingDataGateway.subscribeCollection(
        "accounts",
        setFinancialAccounts,
        error => console.error("Error loading financial accounts:", error)
      ),
    []
  );

  useEffect(
    () =>
      financeAccountingDataGateway.subscribeCollection(
        "custody_advances",
        setCustodyAdvances,
        error => console.error("Error loading custody advances:", error)
      ),
    []
  );

  useEffect(() => {
    const unsubEntries = financeAccountingDataGateway.subscribeCollection(
      "main_entry",
      setFinancialEntries,
      error => console.error("Error loading main_entry:", error)
    );
    const unsub = financeAccountingDataGateway.subscribeCollection(
      "account_trans",
      rows =>
        setAccountTransactions(
          rows.map(row => ({
            ...row,
            type:
              typeof row.type === "string"
                ? row.type
                : typeof row.transType === "string"
                  ? row.transType
                  : undefined,
            amount: toFinanceScalar(row.amount ?? row.amountOriginal),
            amountOriginal: toFinanceScalar(row.amountOriginal),
            entryId: typeof row.entryId === "string" ? row.entryId : undefined,
          }))
        ),
      error => console.error("Error loading account_trans:", error)
    );
    return () => {
      unsubEntries();
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsubH = financeAccountingDataGateway.subscribeOrderedCollection(
      "salary_history",
      "createdAt",
      setSalaryHistory,
      error => console.error("[SalaryTab] salary_history error:", error)
    );
    const unsubE = financeAccountingDataGateway.subscribeCollection(
      "users",
      setEmployees,
      error => console.error("[SalaryTab] users error:", error)
    );
    return () => {
      unsubH();
      unsubE();
    };
  }, []);

  return {
    assets,
    financialAccounts,
    custodyAdvances,
    accountTransactions,
    financialEntries,
    salaryHistory,
    employees,
  };
}
