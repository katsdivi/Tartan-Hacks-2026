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
  location?: {
    lat: number;
    lon: number;
    city?: string;
    region?: string;
  };
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
    } catch { }
  }, []);

  const saveBudgets = useCallback(async (newBudgets: BudgetCategory[]) => {
    try {
      await AsyncStorage.setItem("budgets", JSON.stringify(newBudgets));
    } catch { }
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

  const DEMO_ACCOUNTS: Account[] = [
    {
      account_id: "661f43a9d949ec302e1b1999", // Nessie-like ID
      name: "Capital One 360 Checking",
      official_name: "Capital One 360 Checking",
      type: "depository",
      subtype: "checking",
      balances: { available: 5430.50, current: 5430.50, limit: null },
    },
    {
      account_id: "661f43a9d949ec302e1b199a",
      name: "Capital One 360 Savings",
      official_name: "Capital One 360 Performance Savings",
      type: "depository",
      subtype: "savings",
      balances: { available: 12500.00, current: 12500.00, limit: null },
    },
    {
      account_id: "661f43a9d949ec302e1b199b",
      name: "Venture X",
      official_name: "Capital One Venture X Rewards Credit Card",
      type: "credit",
      subtype: "credit card",
      balances: { available: 15000.00, current: 432.15, limit: 20000.00 },
    }
  ];

  const DEMO_TRANSACTIONS: Transaction[] = [
    // --- Purchases ---
    {
      transaction_id: "p1", account_id: "661f43a9d949ec302e1b1999", name: "Whole Foods Market",
      amount: 145.20, date: new Date().toISOString().split('T')[0],
      category: ["Food and Drink", "Groceries"], pending: false, merchant_name: "Whole Foods",
      payment_channel: "in store",
      location: { lat: 38.9072, lon: -77.0369, city: "Washington", region: "DC" }
    },
    {
      transaction_id: "p2", account_id: "661f43a9d949ec302e1b1999", name: "Uber Ride",
      amount: 24.50, date: new Date().toISOString().split('T')[0],
      category: ["Travel", "Taxi"], pending: false, merchant_name: "Uber",
      payment_channel: "online",
      location: { lat: 38.8951, lon: -77.0364, city: "Washington", region: "DC" }
    },
    {
      transaction_id: "p3", account_id: "661f43a9d949ec302e1b199b", name: "Netflix Subscription",
      amount: 15.99, date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      category: ["Entertainment", "Streaming"], pending: false, merchant_name: "Netflix",
      payment_channel: "recurring",
      location: { lat: 37.2388, lon: -121.9698, city: "Los Gatos", region: "CA" }
    },
    {
      transaction_id: "p4", account_id: "661f43a9d949ec302e1b199b", name: "Apple Store",
      amount: 999.00, date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
      category: ["Shopping", "Electronics"], pending: false, merchant_name: "Apple",
      payment_channel: "in store",
      location: { lat: 40.7645, lon: -73.9730, city: "New York", region: "NY" }
    },
    {
      transaction_id: "p5", account_id: "661f43a9d949ec302e1b1999", name: "Starbucks",
      amount: 6.45, date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
      category: ["Food and Drink", "Coffee Shop"], pending: false, merchant_name: "Starbucks",
      payment_channel: "in store",
      location: { lat: 40.7550, lon: -73.9855, city: "New York", region: "NY" }
    },

    // --- Bills ---
    {
      transaction_id: "b1", account_id: "661f43a9d949ec302e1b1999", name: "Verizon Wireless",
      amount: 85.00, date: new Date(Date.now() - 432000000).toISOString().split('T')[0],
      category: ["Service", "Phone"], pending: false, merchant_name: "Verizon",
      payment_channel: "online",
    },
    {
      transaction_id: "b2", account_id: "661f43a9d949ec302e1b1999", name: "Con Edison",
      amount: 120.50, date: new Date(Date.now() - 604800000).toISOString().split('T')[0],
      category: ["Service", "Utilities"], pending: false, merchant_name: "Con Edison",
      payment_channel: "online",
    },

    // --- Deposits (Negative amount for spending context, or handled as income) ---
    // In our finance context, positive is spending. So income should optionally be negative? 
    // Wait, the mapping logic for Nessie deposits was `amount: -p.amount`. 
    // So for consistency with our mapping logic, a deposit should have a negative amount here.
    {
      transaction_id: "d1", account_id: "661f43a9d949ec302e1b1999", name: "Payroll Deposit",
      amount: -2500.00, date: new Date(Date.now() - 1209600000).toISOString().split('T')[0],
      category: ["Income", "Wages"], pending: false, merchant_name: "Employer Inc.",
      payment_channel: "other",
    },

    // --- Transfers ---
    {
      transaction_id: "t1", account_id: "661f43a9d949ec302e1b1999", name: "Transfer to Savings",
      amount: 500.00, date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
      category: ["Transfer", "Savings"], pending: false, merchant_name: null,
      payment_channel: "transfer",
    },
    {
      transaction_id: "t2", account_id: "661f43a9d949ec302e1b199a", name: "Transfer from Checking",
      amount: -500.00, date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
      category: ["Transfer", "Savings"], pending: false, merchant_name: null,
      payment_channel: "transfer",
    },

    // --- Withdrawals ---
    {
      transaction_id: "w1", account_id: "661f43a9d949ec302e1b1999", name: "ATM Withdrawal",
      amount: 100.00, date: new Date(Date.now() - 864000000).toISOString().split('T')[0],
      category: ["Transfer", "Cash"], pending: false, merchant_name: "ATM",
      payment_channel: "atm",
    }
  ];

  const loadDemoData = useCallback(() => {
    setIsLoading(true);

    // Fetch from Nessie API via our backend
    const fetchData = async () => {
      try {
        // 1. Get customers
        const customersRes = await apiRequest("GET", "/api/capitalone/customers");
        const customersData = await customersRes.json();
        const customers = customersData.customers || [];

        if (customers.length === 0) throw new Error("No Capital One customers found.");

        const customerId = customers[0]._id;

        // 2. Get snapshot
        const snapshotRes = await apiRequest("GET", `/api/capitalone/customer/${customerId}/snapshot`);
        const snapshot = await snapshotRes.json();

        // 3. Map to internal state
        // ... (mapping logic remains same, but omitted for brevity in this chunk reuse if possible, but easier to replace whole block for safety) 

        // Since I'm replacing a specific chunk, let me include the mapping logic again to be safe and robust

        const newAccounts: Account[] = [];
        const newTransactions: Transaction[] = [];

        (snapshot.accounts || []).forEach((item: any) => {
          const a = item.account;
          if (!a || a.error) return;

          newAccounts.push({
            account_id: a._id,
            name: a.nickname || a.type,
            official_name: a.nickname,
            type: a.type,
            subtype: null,
            balances: {
              available: a.balance,
              current: a.balance,
              limit: null
            }
          });

          // Purchases
          (item.purchases || []).forEach((p: any) => {
            if (p.error) return;
            newTransactions.push({
              transaction_id: p._id,
              account_id: a._id,
              name: p.description || "Purchase",
              amount: p.amount,
              date: p.purchase_date,
              category: ["Purchase"],
              pending: p.status === 'pending',
              merchant_name: null,
              payment_channel: "online"
            });
          });

          // Bills
          (item.bills || []).forEach((p: any) => {
            if (p.error) return;
            newTransactions.push({
              transaction_id: p._id,
              account_id: a._id,
              name: "Bill Payment",
              amount: p.payment_amount,
              date: p.payment_date,
              category: ["Bill"],
              pending: p.status === 'pending',
              merchant_name: p.payee,
              payment_channel: "online"
            });
          });

          // Deposits
          (item.deposits || []).forEach((p: any) => {
            if (p.error) return;
            newTransactions.push({
              transaction_id: p._id,
              account_id: a._id,
              name: p.description || "Deposit",
              amount: -p.amount,
              date: p.transaction_date,
              category: ["Deposit"],
              pending: p.status === 'pending',
              merchant_name: "Deposit",
              payment_channel: "online"
            });
          });

          // Withdrawals
          (item.withdrawals || []).forEach((p: any) => {
            if (p.error) return;
            newTransactions.push({
              transaction_id: p._id,
              account_id: a._id,
              name: "Withdrawal",
              amount: p.amount,
              date: p.transaction_date,
              category: ["Withdrawal"],
              pending: p.status === 'pending',
              merchant_name: "Withdrawal",
              payment_channel: "online"
            });
          });
        });

        setAccounts(newAccounts);
        setTransactions(newTransactions);
        setIsConnected(true);
        setIsDemoMode(true);
        setConnectionError(null); // Clear error if successful

        // Recalculate derived state
        const netWorth = newAccounts.reduce((sum, acc) => {
          const bal = acc.balances.current || acc.balances.available || 0;
          if (acc.type === "credit" || acc.type === "loan") return sum - bal;
          return sum + bal;
        }, 0);
        generateNetWorthHistory(netWorth);

        const currentBudgets = [...DEFAULT_BUDGETS];
        updateBudgetSpending(newTransactions, currentBudgets);

      } catch (e) {
        console.warn("Failed to load Nessie data, falling back to static demo data:", e);
        // Fallback to static demo data
        setAccounts(DEMO_ACCOUNTS);
        setTransactions(DEMO_TRANSACTIONS);
        setIsConnected(true);
        setIsDemoMode(true);
        // Optionally show a non-blocking toast or just log it
        setConnectionError("Using demo data (Capital One API unavailable)");

        const netWorth = DEMO_ACCOUNTS.reduce((sum, acc) => {
          const bal = acc.balances.current || acc.balances.available || 0;
          if (acc.type === "credit" || acc.type === "loan") return sum - bal;
          return sum + bal;
        }, 0);
        generateNetWorthHistory(netWorth);
        updateBudgetSpending(DEMO_TRANSACTIONS, [...DEFAULT_BUDGETS]);

      } finally {
        setIsLoading(false);
      }
    };

    fetchData();



  }, [generateNetWorthHistory, updateBudgetSpending]); // Removed saveBudgets dep to updateBudgetSpending handles saving

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
    } catch { }
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
