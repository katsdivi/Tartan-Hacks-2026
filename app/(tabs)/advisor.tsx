import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/colors";

export default function AdvisorTab() {
  useEffect(() => {
    router.push("/advisor-modal");
  }, []);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
