import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export interface Account {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
}

export interface Transaction {
  transaction_id: string;
  account_id: string;
  name: string;
  amount: number;
  date: string;
  category: string[] | null;
  pending: boolean;
  merchant_name: string | null;
  payment_channel: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  limit: number;
  spent: number;
  icon: string;
  color: string;
}

export interface NetWorthHistory {
  date: string;
  value: number;
}

interface FinanceContextValue {
  isConnected: boolean;
  isLoading: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  netWorthHistory: NetWorthHistory[];
  totalNetWorth: number;
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: () => Promise<void>;
  refreshData: () => Promise<void>;
  updateBudget: (id: string, updates: Partial<BudgetCategory>) => Promise<void>;
  addBudgetCategory: (category: Omit<BudgetCategory, "id" | "spent">) => Promise<void>;
  deleteBudgetCategory: (id: string) => Promise<void>;
  getFinancialContext: () => string;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const DEFAULT_BUDGETS: BudgetCategory[] = [
  { id: "food", name: "Food & Dining", limit: 500, spent: 0, icon: "restaurant", color: "#F59E0B" },
  { id: "transport", name: "Transportation", limit: 200, spent: 0, icon: "directions-car", color: "#3B82F6" },
  { id: "shopping", name: "Shopping", limit: 300, spent: 0, icon: "shopping-bag", color: "#EC4899" },
  { id: "entertainment", name: "Entertainment", limit: 150, spent: 0, icon: "movie", color: "#8B5CF6" },
  { id: "bills", name: "Bills & Utilities", limit: 400, spent: 0, icon: "receipt", color: "#10B981" },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function categorizeToBudget(transaction: Transaction): string | null {
  const cats = transaction.category || [];
  const name = transaction.name.toLowerCase();
  const catStr = cats.join(" ").toLowerCase();

  if (catStr.includes("food") || catStr.includes("restaurant") || name.includes("uber eats") || name.includes("doordash")) return "food";
  if (catStr.includes("travel") || catStr.includes("taxi") || catStr.includes("transportation") || name.includes("uber") || name.includes("lyft")) return "transport";
  if (catStr.includes("shop") || catStr.includes("merchandise")) return "shopping";
  if (catStr.includes("entertainment") || catStr.includes("recreation")) return "entertainment";
  if (catStr.includes("utility") || catStr.includes("telecom") || catStr.includes("service")) return "bills";
  return null;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(DEFAULT_BUDGETS);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistory[]>([]);

  const totalNetWorth = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const bal = acc.balances.current || acc.balances.available || 0;
      if (acc.type === "credit" || acc.type === "loan") {
        return sum - bal;
      }
      return sum + bal;
    }, 0);
  }, [accounts]);

  const loadBudgets = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("budgets");
      if (stored) {
        setBudgets(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const saveBudgets = useCallback(async (newBudgets: BudgetCategory[]) => {
    try {
      await AsyncStorage.setItem("budgets", JSON.stringify(newBudgets));
    } catch {}
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/plaid/status");
      const data = await res.json();
      setIsConnected(data.connected);
      return data.connected;
    } catch {
      return false;
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/plaid/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
      return data.accounts || [];
    } catch {
      return [];
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/plaid/transactions");
      const data = await res.json();
      setTransactions(data.transactions || []);
      return data.transactions || [];
    } catch {
      return [];
    }
  }, []);

  const updateBudgetSpending = useCallback((txns: Transaction[], currentBudgets: BudgetCategory[]) => {
    const spending: Record<string, number> = {};
    txns.forEach((tx) => {
      if (tx.amount > 0) {
        const budgetId = categorizeToBudget(tx);
        if (budgetId) {
          spending[budgetId] = (spending[budgetId] || 0) + tx.amount;
        }
      }
    });

    const updated = currentBudgets.map((b) => ({
      ...b,
      spent: Math.round((spending[b.id] || 0) * 100) / 100,
    }));
    setBudgets(updated);
    saveBudgets(updated);
    return updated;
  }, [saveBudgets]);

  const generateNetWorthHistory = useCallback((accs: Account[]) => {
    const currentNetWorth = accs.reduce((sum, acc) => {
      const bal = acc.balances.current || acc.balances.available || 0;
      if (acc.type === "credit" || acc.type === "loan") return sum - bal;
      return sum + bal;
    }, 0);

    const history: NetWorthHistory[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const variation = 1 - (i * 0.02) + (Math.random() * 0.01 - 0.005);
      history.push({
        date: d.toISOString().split("T")[0],
        value: Math.round(currentNetWorth * variation),
      });
    }
    setNetWorthHistory(history);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadBudgets();
      const connected = await checkConnection();
      if (connected) {
        const accs = await fetchAccounts();
        const txns = await fetchTransactions();
        generateNetWorthHistory(accs);
        const stored = await AsyncStorage.getItem("budgets");
        const currentBudgets = stored ? JSON.parse(stored) : DEFAULT_BUDGETS;
        updateBudgetSpending(txns, currentBudgets);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkConnection, fetchAccounts, fetchTransactions, loadBudgets, generateNetWorthHistory, updateBudgetSpending]);

  const connectBank = useCallback(async (publicToken: string) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/plaid/exchange-token", { public_token: publicToken });
      setIsConnected(true);
      await refreshData();
    } finally {
      setIsLoading(false);
    }
  }, [refreshData]);

  const disconnectBank = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/plaid/disconnect");
      setIsConnected(false);
      setAccounts([]);
      setTransactions([]);
      setNetWorthHistory([]);
    } catch {}
  }, []);

  const updateBudget = useCallback(async (id: string, updates: Partial<BudgetCategory>) => {
    setBudgets((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
      saveBudgets(updated);
      return updated;
    });
  }, [saveBudgets]);

  const addBudgetCategory = useCallback(async (category: Omit<BudgetCategory, "id" | "spent">) => {
    const newCat: BudgetCategory = { ...category, id: generateId(), spent: 0 };
    setBudgets((prev) => {
      const updated = [...prev, newCat];
      saveBudgets(updated);
      return updated;
    });
  }, [saveBudgets]);

  const deleteBudgetCategory = useCallback(async (id: string) => {
    setBudgets((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveBudgets(updated);
      return updated;
    });
  }, [saveBudgets]);

  const getFinancialContext = useCallback(() => {
    if (!isConnected || accounts.length === 0) return "";

    let context = `Net Worth: $${totalNetWorth.toLocaleString()}\n\nAccounts:\n`;
    accounts.forEach((a) => {
      const bal = a.balances.current || a.balances.available || 0;
      context += `- ${a.name} (${a.type}): $${bal.toLocaleString()}\n`;
    });

    if (transactions.length > 0) {
      const totalSpending = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      context += `\nRecent Spending (7 days): $${totalSpending.toFixed(2)}\n`;
      context += `Number of transactions: ${transactions.length}\n`;

      const topCategories: Record<string, number> = {};
      transactions.forEach((t) => {
        if (t.amount > 0 && t.category?.[0]) {
          topCategories[t.category[0]] = (topCategories[t.category[0]] || 0) + t.amount;
        }
      });
      const sorted = Object.entries(topCategories).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (sorted.length > 0) {
        context += "\nTop spending categories:\n";
        sorted.forEach(([cat, amount]) => {
          context += `- ${cat}: $${amount.toFixed(2)}\n`;
        });
      }
    }

    if (budgets.length > 0) {
      context += "\nMonthly Budgets:\n";
      budgets.forEach((b) => {
        const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
        context += `- ${b.name}: $${b.spent.toFixed(2)} / $${b.limit} (${pct}%)\n`;
      });
    }

    return context;
  }, [isConnected, accounts, transactions, budgets, totalNetWorth]);

  const value = useMemo(() => ({
    isConnected,
    isLoading,
    accounts,
    transactions,
    budgets,
    netWorthHistory,
    totalNetWorth,
    connectBank,
    disconnectBank,
    refreshData,
    updateBudget,
    addBudgetCategory,
    deleteBudgetCategory,
    getFinancialContext,
  }), [isConnected, isLoading, accounts, transactions, budgets, netWorthHistory, totalNetWorth, connectBank, disconnectBank, refreshData, updateBudget, addBudgetCategory, deleteBudgetCategory, getFinancialContext]);

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }
  return context;
}
