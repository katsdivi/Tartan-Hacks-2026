import { useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFinance } from "@/lib/finance-context";
import Colors from "@/constants/colors";

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MiniChart({ data, prediction }: { data: number[]; prediction: number[] }) {
  if (data.length < 2) return null;
  const all = [...data, ...prediction];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const w = 280;
  const h = 80;
  const totalPoints = data.length + prediction.length - 1;

  const toPoint = (val: number, idx: number) => {
    const x = (idx / (totalPoints - 1)) * w;
    const y = h - ((val - min) / range) * h * 0.8 - h * 0.1;
    return { x, y };
  };

  const dataPath = data.map((v, i) => {
    const p = toPoint(v, i);
    return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
  }).join(" ");

  const predPath = prediction.length > 0
    ? [toPoint(data[data.length - 1], data.length - 1), ...prediction.map((v, i) => toPoint(v, data.length + i))]
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ")
    : "";

  const Svg = require("react-native-svg");

  return (
    <Svg.Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Svg.Defs>
        <Svg.LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <Svg.Stop offset="0%" stopColor={Colors.light.tint} stopOpacity="0.3" />
          <Svg.Stop offset="100%" stopColor={Colors.light.tint} stopOpacity="0" />
        </Svg.LinearGradient>
      </Svg.Defs>
      {data.length > 1 && (
        <>
          <Svg.Path
            d={`${dataPath} L ${toPoint(data[data.length - 1], data.length - 1).x} ${h} L ${toPoint(data[0], 0).x} ${h} Z`}
            fill="url(#lineGrad)"
          />
          <Svg.Path d={dataPath} stroke={Colors.light.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {predPath && (
        <Svg.Path d={predPath} stroke={Colors.light.chartPrediction} strokeWidth="2" fill="none" strokeDasharray="6 4" strokeLinecap="round" />
      )}
    </Svg.Svg>
  );
}

function AccountCard({ account }: { account: any }) {
  const balance = account.balances.current || account.balances.available || 0;
  const isCredit = account.type === "credit" || account.type === "loan";

  return (
    <View style={styles.accountCard}>
      <View style={styles.accountIconWrap}>
        <MaterialIcons
          name={isCredit ? "credit-card" : account.type === "investment" ? "trending-up" : "account-balance"}
          size={20}
          color={Colors.light.tint}
        />
      </View>
      <View style={styles.accountInfo}>
        <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
        <Text style={styles.accountType}>{account.subtype || account.type}</Text>
      </View>
      <Text style={[styles.accountBalance, isCredit && styles.negativeText]}>
        {isCredit ? "-" : ""}${Math.abs(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, isLoading, accounts, totalNetWorth, netWorthHistory, transactions, refreshData } = useFinance();

  useEffect(() => {
    refreshData();
  }, []);

  const onRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const predictionData = netWorthHistory.length > 0
    ? Array.from({ length: 3 }, (_, i) => {
        const last = netWorthHistory[netWorthHistory.length - 1].value;
        const growthRate = 0.015;
        return Math.round(last * (1 + growthRate * (i + 1)));
      })
    : [];

  const monthlyChange = netWorthHistory.length >= 2
    ? netWorthHistory[netWorthHistory.length - 1].value - netWorthHistory[netWorthHistory.length - 2].value
    : 0;
  const changePercent = netWorthHistory.length >= 2 && netWorthHistory[netWorthHistory.length - 2].value !== 0
    ? ((monthlyChange / netWorthHistory[netWorthHistory.length - 2].value) * 100).toFixed(1)
    : "0";

  const recentSpending = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 16 }]}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.light.tint} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Your Finances</Text>
        {isConnected && (
          <View style={styles.connectedBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        )}
      </View>

      {!isConnected ? (
        <View style={styles.connectCard}>
          <LinearGradient
            colors={[Colors.light.gradient1, Colors.light.gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.connectGradient}
          >
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
            <Text style={styles.connectTitle}>Connect Your Bank</Text>
            <Text style={styles.connectSubtitle}>
              Link your accounts to track spending, net worth, and get personalized advice.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.connectButton, pressed && { opacity: 0.9 }]}
              onPress={() => router.push("/plaid-link")}
            >
              <Text style={styles.connectButtonText}>Connect Account</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.light.gradient1} />
            </Pressable>
          </LinearGradient>
        </View>
      ) : (
        <>
          <View style={styles.netWorthCard}>
            <Text style={styles.netWorthLabel}>Net Worth</Text>
            <Text style={styles.netWorthValue}>{formatCurrency(totalNetWorth)}</Text>
            <View style={styles.changeRow}>
              <Ionicons
                name={monthlyChange >= 0 ? "arrow-up" : "arrow-down"}
                size={14}
                color={monthlyChange >= 0 ? Colors.light.positive : Colors.light.negative}
              />
              <Text style={[styles.changeText, { color: monthlyChange >= 0 ? Colors.light.positive : Colors.light.negative }]}>
                {formatCurrency(Math.abs(monthlyChange))} ({changePercent}%)
              </Text>
              <Text style={styles.changePeriod}>this month</Text>
            </View>
            <View style={styles.chartContainer}>
              <MiniChart
                data={netWorthHistory.map((h) => h.value)}
                prediction={predictionData}
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: Colors.light.tint }]} />
                  <Text style={styles.legendText}>Actual</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: Colors.light.chartPrediction, borderStyle: "dashed" }]} />
                  <Text style={styles.legendText}>Predicted</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.light.positiveLight }]}>
                <Ionicons name="wallet" size={18} color={Colors.light.positive} />
              </View>
              <Text style={styles.statValue}>{accounts.length}</Text>
              <Text style={styles.statLabel}>Accounts</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.light.negativeLight }]}>
                <Ionicons name="cart" size={18} color={Colors.light.negative} />
              </View>
              <Text style={styles.statValue}>${recentSpending.toFixed(0)}</Text>
              <Text style={styles.statLabel}>7-Day Spend</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.light.accentLight }]}>
                <Ionicons name="trending-up" size={18} color={Colors.light.accent} />
              </View>
              <Text style={styles.statValue}>{changePercent}%</Text>
              <Text style={styles.statLabel}>Growth</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accounts</Text>
          </View>
          {accounts.map((account) => (
            <AccountCard key={account.account_id} account={account} />
          ))}
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.positiveLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.positive,
  },
  connectedText: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.positive,
  },
  connectCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
  },
  connectGradient: {
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  connectTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    marginTop: 4,
  },
  connectSubtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.gradient1,
  },
  netWorthCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  netWorthLabel: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  netWorthValue: {
    fontSize: 36,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
    letterSpacing: -1,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginBottom: 20,
  },
  changeText: {
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
  },
  changePeriod: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  chartContainer: {
    alignItems: "center",
  },
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  accountType: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
    textTransform: "capitalize" as const,
  },
  accountBalance: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  negativeText: {
    color: Colors.light.negative,
  },
});
