import { useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFinance } from "@/lib/finance-context";
import Colors from "@/constants/colors";

function getCategoryIcon(categories: string[] | null, name: string): { icon: string; color: string } {
  const cat = (categories?.[0] || "").toLowerCase();
  const n = name.toLowerCase();

  if (cat.includes("food") || cat.includes("restaurant") || n.includes("starbucks") || n.includes("mcdonald")) {
    return { icon: "restaurant", color: "#F59E0B" };
  }
  if (cat.includes("travel") || cat.includes("taxi") || cat.includes("transport") || n.includes("uber") || n.includes("lyft")) {
    return { icon: "directions-car", color: "#3B82F6" };
  }
  if (cat.includes("shop") || cat.includes("merch") || n.includes("amazon") || n.includes("target")) {
    return { icon: "shopping-bag", color: "#EC4899" };
  }
  if (cat.includes("entertainment") || cat.includes("recreation") || n.includes("netflix") || n.includes("spotify")) {
    return { icon: "movie", color: "#8B5CF6" };
  }
  if (cat.includes("transfer") || cat.includes("payment")) {
    return { icon: "swap-horiz", color: "#6B7280" };
  }
  if (cat.includes("deposit") || cat.includes("income") || cat.includes("payroll")) {
    return { icon: "attach-money", color: "#10B981" };
  }
  if (cat.includes("utility") || cat.includes("telecom") || cat.includes("service")) {
    return { icon: "receipt", color: "#0D9488" };
  }
  return { icon: "receipt-long", color: "#6B7280" };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function TransactionItem({ transaction }: { transaction: any }) {
  const { icon, color } = getCategoryIcon(transaction.category, transaction.name);
  const isIncome = transaction.amount < 0;
  const displayAmount = Math.abs(transaction.amount);

  return (
    <View style={styles.txItem}>
      <View style={[styles.txIconWrap, { backgroundColor: color + "18" }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txName} numberOfLines={1}>
          {transaction.merchant_name || transaction.name}
        </Text>
        <Text style={styles.txCategory}>
          {transaction.category?.[0] || "Uncategorized"}
        </Text>
      </View>
      <View style={styles.txAmountWrap}>
        <Text style={[styles.txAmount, isIncome && styles.incomeAmount]}>
          {isIncome ? "+" : "-"}${displayAmount.toFixed(2)}
        </Text>
        <Text style={styles.txDate}>{formatDate(transaction.date)}</Text>
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, isLoading, transactions, refreshData } = useFinance();

  useEffect(() => {
    if (isConnected) refreshData();
  }, []);

  const onRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const groupedTransactions = transactions.reduce((groups: Record<string, any[]>, tx) => {
    const date = tx.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {});

  const sections = Object.entries(groupedTransactions)
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([date, txs]) => [
      { type: "header" as const, date, id: `header-${date}` },
      ...txs.map((tx: any) => ({ type: "transaction" as const, ...tx, id: tx.transaction_id })),
    ]);

  const totalSpending = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Last 7 days</Text>
      </View>

      {isConnected && transactions.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: Colors.light.negativeLight }]}>
            <Ionicons name="arrow-up" size={14} color={Colors.light.negative} />
            <Text style={[styles.summaryAmount, { color: Colors.light.negative }]}>
              ${totalSpending.toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>Spent</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: Colors.light.positiveLight }]}>
            <Ionicons name="arrow-down" size={14} color={Colors.light.positive} />
            <Text style={[styles.summaryAmount, { color: Colors.light.positive }]}>
              ${totalIncome.toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>Received</Text>
          </View>
        </View>
      )}

      {!isConnected ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="list" size={32} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No Transactions</Text>
          <Text style={styles.emptySubtitle}>
            Connect your bank account to see your recent transactions here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{formatDate(item.date)}</Text>
                </View>
              );
            }
            return <TransactionItem transaction={item} />;
          }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.light.tint} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color={Colors.light.textTertiary} />
                <Text style={styles.emptyTitle}>No Recent Transactions</Text>
                <Text style={styles.emptySubtitle}>
                  Transactions from the last 7 days will appear here.
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  summaryAmount: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  dateHeader: {
    paddingVertical: 8,
    marginTop: 8,
  },
  dateHeaderText: {
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txName: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  txCategory: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  txAmountWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  txAmount: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  incomeAmount: {
    color: Colors.light.positive,
  },
  txDate: {
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
