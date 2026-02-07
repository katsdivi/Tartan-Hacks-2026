/**
 * DangerZoneAlert — Displays danger zone warnings on the dashboard.
 *
 * Shows locations where the user historically regrets spending,
 * integrated from the Purchase Predictor ML pipeline.
 *
 * Source: https://github.com/Abhinavvvkk07/pp_roots
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFinance } from "@/lib/finance-context";

export function DangerZoneAlert() {
  const { dangerZones } = useFinance();
  const [expanded, setExpanded] = React.useState(false);

  if (dangerZones.length === 0) return null;

  const totalRegrets = dangerZones.reduce((sum, z) => sum + z.regret_count, 0);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={20} color={Colors.light.neonYellow} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Spending Danger Zones</Text>
            <Text style={styles.subtitle}>
              {dangerZones.length} location{dangerZones.length !== 1 ? "s" : ""} flagged
              {" "}({totalRegrets} total regrets)
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#666" />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.zoneList}>
            {dangerZones.map((zone, index) => (
              <View key={`${zone.merchant}-${index}`} style={styles.zoneItem}>
                <View style={styles.zoneIcon}>
                  <MaterialIcons name="location-on" size={20} color={Colors.light.negative} />
                </View>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.merchant}</Text>
                  <Text style={styles.zoneCoords}>
                    {zone.address || `${zone.lat.toFixed(3)}, ${zone.lng.toFixed(3)}`}
                  </Text>
                </View>
                <View style={styles.regretBadge}>
                  <Text style={styles.regretCount}>{zone.regret_count}</Text>
                  <Text style={styles.regretLabel}>regrets</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.infoBar}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.light.tint} />
            <Text style={styles.infoText}>
              AI-powered geofence alerts will nudge you near these spots
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 229, 0, 0.2)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
    paddingBottom: 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 229, 0, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  zoneList: {
    gap: 12,
  },
  zoneItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  zoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.negativeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneInfo: {
    flex: 1,
    justifyContent: "center",
  },
  zoneName: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
    marginBottom: 2,
    lineHeight: 20,
  },
  zoneCoords: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  regretBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.negativeLight,
    borderRadius: 12,
  },
  regretCount: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.negative,
  },
  regretLabel: {
    fontSize: 9,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.negative,
    marginTop: -1,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  infoText: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
    flex: 1,
  },
  content: {
    marginTop: 16,
  }
});

export default DangerZoneAlert;
