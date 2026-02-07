import { useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Modal,
  Button,
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
          <Svg.Stop offset="0%" stopColor={Colors.light.tint} stopOpacity="0.25" />
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

function ErrorPopup({ message, onDismiss, onDemo }: { message: string; onDismiss: () => void; onDemo: () => void }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.errorOverlay}>
        <View style={styles.errorCard}>
          <Pressable style={styles.errorClose} onPress={onDismiss}>
            <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
          </Pressable>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={36} color={Colors.light.negative} />
          </View>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <View style={styles.errorActions}>
            <Pressable style={styles.errorDemoBtn} onPress={onDemo}>
              <Text style={styles.errorDemoBtnText}>Use Demo Data</Text>
            </Pressable>
            <Pressable style={styles.errorRetryBtn} onPress={onDismiss}>
              <Text style={styles.errorRetryBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    isConnected, isDemoMode, isLoading, accounts, totalNetWorth, netWorthHistory,
    transactions, refreshData, connectionError, dismissError, loadDemoData,
  } = useFinance();

  const checkHealth = () => {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://172.25.4.240:5001";
    fetch(`${API_BASE_URL}/health`).then(r => r.json()).then(console.log).catch(console.error)
  };

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
      {connectionError && (
        <ErrorPopup
          message={connectionError}
          onDismiss={dismissError}
          onDemo={() => { dismissError(); loadDemoData(); }}
        />
      )}

      <View style={styles.header}>
        <Text style={styles.greeting}>Dashboard</Text>
        <Button title="Health Check" onPress={checkHealth} />
        {isConnected && (
          <View style={styles.connectedBadge}>
            <View style={styles.glowDot} />
            <Text style={styles.connectedText}>{isDemoMode ? "Demo" : "Live"}</Text>
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
            <Ionicons name="shield-checkmark" size={40} color={Colors.light.background} />
            <Text style={styles.connectTitle}>Connect Your Bank</Text>
            <Text style={styles.connectSubtitle}>
              Link your accounts to track spending, net worth, and get personalized advice.
            </Text>
            <View style={styles.connectActions}>
              <Pressable
                style={({ pressed }) => [styles.connectButton, pressed && { opacity: 0.9 }]}
                onPress={() => router.push("/plaid-link")}
              >
                <Text style={styles.connectButtonText}>Connect Account</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.light.gradient1} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.demoButton, pressed && { opacity: 0.7 }]}
                onPress={loadDemoData}
              >
                <Text style={styles.demoButtonText}>Try Demo Data</Text>
              </Pressable>
            </View>
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
                  <View style={[styles.legendLine, { backgroundColor: Colors.light.chartPrediction }]} />
                  <Text style={styles.legendText}>Predicted</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.light.tintLight }]}>
                <Ionicons name="wallet" size={18} color={Colors.light.tint} />
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
              <View style={[styles.statIcon, { backgroundColor: Colors.light.positiveLight }]}>
                <Ionicons name="trending-up" size={18} color={Colors.light.positive} />
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
  glowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.positive,
  },
  connectedText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.positive,
  },
  connectCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  connectGradient: {
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  connectTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.background,
    marginTop: 4,
  },
  connectSubtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: "rgba(10,14,26,0.7)",
    textAlign: "center",
    lineHeight: 20,
  },
  connectActions: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.tint,
  },
  demoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  demoButtonText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: "rgba(10,14,26,0.6)",
    textDecorationLine: "underline" as const,
  },
  netWorthCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
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
    color: Colors.light.tint,
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
    borderWidth: 1,
    borderColor: Colors.light.border,
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
    borderWidth: 1,
    borderColor: Colors.light.border,
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
    color: Colors.light.tint,
  },
  negativeText: {
    color: Colors.light.negative,
  },
  errorOverlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  errorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.light.negativeLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  errorActions: {
    width: "100%",
    gap: 10,
  },
  errorDemoBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  errorDemoBtnText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.background,
  },
  errorRetryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorRetryBtnText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
  },
});
