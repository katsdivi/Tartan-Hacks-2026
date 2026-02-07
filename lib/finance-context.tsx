import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";
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
  isDemoMode: boolean;
  isLoading: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  netWorthHistory: NetWorthHistory[];
  totalNetWorth: number;
  connectionError: string | null;
  dismissError: () => void;
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: () => Promise<void>;
  loadDemoData: () => void;
  refreshData: () => Promise<void>;
  updateBudget: (id: string, updates: Partial<BudgetCategory>) => Promise<void>;
  addBudgetCategory: (category: Omit<BudgetCategory, "id" | "spent">) => Promise<void>;
  deleteBudgetCategory: (id: string) => Promise<void>;
  getFinancialContext: () => string;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const DEFAULT_BUDGETS: BudgetCategory[] = [
  { id: "food", name: "Food & Dining", limit: 500, spent: 0, icon: "restaurant", color: "#00F0FF" },
  { id: "transport", name: "Transportation", limit: 200, spent: 0, icon: "directions-car", color: "#0066FF" },
  { id: "shopping", name: "Shopping", limit: 300, spent: 0, icon: "shopping-bag", color: "#FF3D71" },
  { id: "entertainment", name: "Entertainment", limit: 150, spent: 0, icon: "movie", color: "#B83DFF" },
  { id: "bills", name: "Bills & Utilities", limit: 400, spent: 0, icon: "receipt", color: "#00E676" },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function categorizeToBudget(transaction: Transaction): string | null {
  const cats = transaction.category || [];
  const name = transaction.name.toLowerCase();
  const catStr = cats.join(" ").toLowerCase();

  if (catStr.includes("food") || catStr.includes("restaurant") || catStr.includes("coffee") || catStr.includes("grocer") || name.includes("uber eats") || name.includes("doordash") || name.includes("chipotle") || name.includes("starbucks") || name.includes("whole foods")) return "food";
  if (catStr.includes("travel") || catStr.includes("taxi") || catStr.includes("transportation") || catStr.includes("gas") || name.includes("uber") || name.includes("lyft") || name.includes("shell")) return "transport";
  if (catStr.includes("shop") || catStr.includes("merchandise") || catStr.includes("department") || catStr.includes("marketplace") || name.includes("amazon") || name.includes("target")) return "shopping";
  if (catStr.includes("entertainment") || catStr.includes("recreation") || catStr.includes("streaming") || catStr.includes("music") || catStr.includes("gym") || name.includes("netflix") || name.includes("spotify") || name.includes("planet fitness")) return "entertainment";
  if (catStr.includes("utility") || catStr.includes("telecom") || catStr.includes("service") || name.includes("electric") || name.includes("conedison")) return "bills";
  return null;
}

const DEMO_MODE_ENV = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(DEMO_MODE_ENV); // Initialize from env
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(DEFAULT_BUDGETS);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistory[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE_ENV) {
      loadDemoData();
    }
  }, []); // Run once on mount

  const totalNetWorth = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const bal = acc.balances.current || acc.balances.available || 0;
      if (acc.type === "credit" || acc.type === "loan") {
        return sum - bal;
      }
      return sum + bal;
    }, 0);
  }, [accounts]);

  const dismissError = useCallback(() => {
    setConnectionError(null);
  }, []);

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

  const generateNetWorthHistory = useCallback((currentNetWorth: number) => {
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

  const loadDemoData = useCallback(() => {
    // This function will now fetch from backend's demo endpoints
    // No need for client-side dummy data generation anymore
    setIsLoading(true);
    // Simulate API call for demo data
    Promise.all([
      apiRequest("GET", "/api/plaid/accounts").then(res => res.json()),
      apiRequest("GET", "/api/plaid/transactions").then(res => res.json()),
    ]).then(([accountsData, transactionsData]) => {
      const demoAccounts = accountsData.accounts || [];
      const demoTransactions = transactionsData.transactions || [];
      setAccounts(demoAccounts);
      setTransactions(demoTransactions);
      setIsConnected(true);
      setIsDemoMode(true);

      const netWorth = demoAccounts.reduce((sum, acc) => {
        const bal = acc.balances.current || acc.balances.available || 0;
        if (acc.type === "credit" || acc.type === "loan") return sum - bal;
        return sum + bal;
      }, 0);
      generateNetWorthHistory(netWorth);

      const currentBudgets = [...DEFAULT_BUDGETS];
      const spending: Record<string, number> = {};
      demoTransactions.forEach((tx) => {
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
    }).catch(err => {
      console.error("Failed to load demo data from backend:", err);
      setConnectionError("Failed to load demo data. Please ensure backend is running.");
    }).finally(() => {
      setIsLoading(false);
    });
  }, [generateNetWorthHistory, saveBudgets]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadBudgets();
      const connected = await checkConnection();
      if (connected) {
        const accs = await fetchAccounts();
        const txns = await fetchTransactions();
        const netWorth = accs.reduce((sum: number, acc: Account) => {
          const bal = acc.balances.current || acc.balances.available || 0;
          if (acc.type === "credit" || acc.type === "loan") return sum - bal;
          return sum + bal;
        }, 0);
        generateNetWorthHistory(netWorth);
        const stored = await AsyncStorage.getItem("budgets");
        const currentBudgets = stored ? JSON.parse(stored) : DEFAULT_BUDGETS;
        updateBudgetSpending(txns, currentBudgets);
      } else if (DEMO_MODE_ENV) { // If not connected but in demo mode, load demo data
        loadDemoData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [DEMO_MODE_ENV, checkConnection, fetchAccounts, fetchTransactions, loadBudgets, generateNetWorthHistory, updateBudgetSpending, loadDemoData]);

  const connectBank = useCallback(async (publicToken: string) => {
    setIsLoading(true);
    try {
      if (DEMO_MODE_ENV) {
        // In demo mode, simulate successful connection and load demo data
        setIsConnected(true);
        setIsDemoMode(true);
        await loadDemoData();
        return;
      }

      const res = await apiRequest("POST", "/api/plaid/exchange-token", { public_token: publicToken });
      if (!res.ok) {
        throw new Error("Token exchange failed");
      }
      setIsConnected(true);
      setIsDemoMode(false);
      await refreshData();
    } catch (err) {
      setConnectionError("Plaid API connection wasn't successful. You can try again or use demo data to explore the app.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [DEMO_MODE_ENV, refreshData, loadDemoData]);

  const disconnectBank = useCallback(async () => {
    try {
      if (!isDemoMode) {
        await apiRequest("POST", "/api/plaid/disconnect");
      }
      setIsConnected(false);
      setIsDemoMode(false);
      setAccounts([]);
      setTransactions([]);
      setNetWorthHistory([]);
      setBudgets(DEFAULT_BUDGETS);
    } catch {}
  }, [isDemoMode]);

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
    if (accounts.length === 0) return "";

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
  }, [accounts, transactions, budgets, totalNetWorth]);

  const value = useMemo(() => ({
    isConnected,
    isDemoMode,
    isLoading,
    accounts,
    transactions,
    budgets,
    netWorthHistory,
    totalNetWorth,
    connectionError,
    dismissError,
    connectBank,
    disconnectBank,
    loadDemoData,
    refreshData,
    updateBudget,
    addBudgetCategory,
    deleteBudgetCategory,
    getFinancialContext,
  }), [isConnected, isDemoMode, isLoading, accounts, transactions, budgets, netWorthHistory, totalNetWorth, connectionError, dismissError, connectBank, disconnectBank, loadDemoData, refreshData, updateBudget, addBudgetCategory, deleteBudgetCategory, getFinancialContext]);

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
