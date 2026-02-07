import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const FINANCE_TIPS = [
  "The 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
  "Paying yourself first means saving before you spend.",
  "An emergency fund should cover 3-6 months of expenses.",
  "Compound interest is the eighth wonder of the world. Start early.",
  "Automating your savings removes the temptation to skip it.",
  "The average American spends $150/month on subscriptions they forget about.",
  "Paying more than the minimum on credit cards saves you thousands in interest.",
  "A budget isn't a restriction — it's a plan for your money.",
  "The latte factor: small daily expenses add up to thousands per year.",
  "High-yield savings accounts can earn 10-20x more than traditional ones.",
  "Lifestyle creep: when income rises, expenses rise to match. Watch for it.",
  "The best time to start investing was yesterday. The second best is today.",
  "Tracking every dollar for one month can reveal surprising spending patterns.",
  "Needs vs. wants: wait 24 hours before any unplanned purchase over $50.",
  "Negotiating bills (internet, insurance) can save hundreds per year.",
  "Credit utilization under 30% helps maintain a healthy credit score.",
  "Meal prepping can cut your food budget by up to 50%.",
  "Round-up savings: rounding purchases to the nearest dollar adds up fast.",
  "The snowball method: pay off smallest debts first for momentum.",
  "The avalanche method: pay off highest-interest debts first to save money.",
  "Setting specific financial goals makes you 42% more likely to achieve them.",
  "Review your subscriptions quarterly. Cancel what you don't actively use.",
  "A good credit score can save you tens of thousands on a mortgage.",
  "Dollar-cost averaging reduces the risk of investing at the wrong time.",
  "Financial literacy is the most important subject not taught in school.",
];

export default function FinanceTip() {
  const [tip, setTip] = useState("");

  useEffect(() => {
    setTip(FINANCE_TIPS[Math.floor(Math.random() * FINANCE_TIPS.length)]);
  }, []);

  if (!tip) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="bulb-outline" size={16} color={Colors.light.neonYellow} />
      <Text style={styles.text}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.light.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
});
