import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

export default function AdvisorTab() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.content}>
        {/* Glass Card Container */}
        <View style={styles.glassCard}>
          {/* Icon with glow effect */}
          <View style={styles.iconContainer}>
            <View style={styles.iconGlow} />
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles" size={40} color={Colors.light.tint} />
            </View>
          </View>

          <Text style={styles.title}>AI Financial Advisor</Text>
          <Text style={styles.subtitle}>
            Get personalized insights and advice about your finances powered by advanced AI.
          </Text>

          {/* CTA Button */}
          <Pressable
            style={({ pressed }) => [styles.openButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={() => router.push("/advisor-modal")}
          >
            <LinearGradient
              colors={[Colors.light.tint, Colors.light.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.openButtonText}>Start Chat</Text>
              <Ionicons name="chatbubble-ellipses" size={18} color={Colors.light.background} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Features list */}
        <View style={styles.featuresList}>
          {[
            { icon: "trending-up", text: "Spending analysis" },
            { icon: "bulb", text: "Smart recommendations" },
            { icon: "shield-checkmark", text: "Budget protection" },
          ].map((feature) => (
            <View key={feature.text} style={styles.featureItem}>
              <Ionicons name={feature.icon as any} size={18} color={Colors.light.tint} />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 100,
  },
  glassCard: {
    width: '100%',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    overflow: 'hidden',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  iconGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.neonGlow,
    top: -10,
    left: -10,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  title: {
    fontSize: 26,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  openButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 10,
  },
  openButtonText: {
    fontSize: 17,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.background,
  },
  featuresList: {
    marginTop: 32,
    gap: 12,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.text,
  },
});
