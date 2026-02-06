import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFinance } from "@/lib/finance-context";
import Colors from "@/constants/colors";

function BudgetBar({ category }: { category: any }) {
  const progress = category.limit > 0 ? Math.min(category.spent / category.limit, 1) : 0;
  const percentage = Math.round(progress * 100);
  const isOverBudget = category.spent > category.limit;
  const remaining = category.limit - category.spent;

  return (
    <View style={styles.budgetCard}>
      <View style={styles.budgetHeader}>
        <View style={[styles.budgetIconWrap, { backgroundColor: category.color + "18" }]}>
          <MaterialIcons name={category.icon as any} size={20} color={category.color} />
        </View>
        <View style={styles.budgetInfo}>
          <Text style={styles.budgetName}>{category.name}</Text>
          <Text style={styles.budgetRange}>
            ${category.spent.toFixed(0)} of ${category.limit.toFixed(0)}
          </Text>
        </View>
        <View style={[styles.budgetPercentWrap, isOverBudget && { backgroundColor: Colors.light.negativeLight }]}>
          <Text style={[styles.budgetPercent, isOverBudget && { color: Colors.light.negative }]}>
            {percentage}%
          </Text>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: isOverBudget ? Colors.light.negative : percentage > 75 ? Colors.light.neonYellow : category.color,
            },
          ]}
        />
      </View>
      <Text style={[styles.budgetRemaining, isOverBudget && { color: Colors.light.negative }]}>
        {isOverBudget
          ? `$${Math.abs(remaining).toFixed(2)} over budget`
          : `$${remaining.toFixed(2)} remaining`}
      </Text>
    </View>
  );
}

const ICON_OPTIONS = [
  { name: "restaurant", label: "Food" },
  { name: "directions-car", label: "Transport" },
  { name: "shopping-bag", label: "Shopping" },
  { name: "movie", label: "Entertainment" },
  { name: "receipt", label: "Bills" },
  { name: "fitness-center", label: "Fitness" },
  { name: "school", label: "Education" },
  { name: "medical-services", label: "Health" },
  { name: "home", label: "Housing" },
  { name: "savings", label: "Savings" },
];

const COLOR_OPTIONS = [
  Colors.light.tint,
  Colors.light.neonBlue,
  Colors.light.neonPink,
  Colors.light.neonPurple,
  Colors.light.neonGreen,
  Colors.light.negative,
  Colors.light.neonYellow,
  "#FF8C00",
];

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, isLoading, budgets, refreshData, addBudgetCategory, updateBudget, deleteBudgetCategory } = useFinance();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("restaurant");
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);

  useEffect(() => {
    refreshData();
  }, []);

  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalProgress = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1) : 0;

  const handleAddBudget = useCallback(async () => {
    if (!newName.trim() || !newLimit.trim()) return;
    const limit = parseFloat(newLimit);
    if (isNaN(limit) || limit <= 0) return;

    await addBudgetCategory({
      name: newName.trim(),
      limit,
      icon: selectedIcon,
      color: selectedColor,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddModal(false);
    setNewName("");
    setNewLimit("");
    setSelectedIcon("restaurant");
    setSelectedColor(COLOR_OPTIONS[0]);
  }, [newName, newLimit, selectedIcon, selectedColor, addBudgetCategory]);

  const handleEditLimit = useCallback(async (id: string) => {
    const budget = budgets.find((b) => b.id === id);
    if (!budget) return;
    setEditingBudget(id);
    setNewLimit(budget.limit.toString());
  }, [budgets]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingBudget || !newLimit.trim()) return;
    const limit = parseFloat(newLimit);
    if (isNaN(limit) || limit <= 0) return;

    await updateBudget(editingBudget, { limit });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditingBudget(null);
    setNewLimit("");
  }, [editingBudget, newLimit, updateBudget]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert("Delete Budget", "Are you sure you want to remove this budget category?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteBudgetCategory(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [deleteBudgetCategory]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Budget</Text>
            <Text style={styles.subtitle}>This month</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setShowAddModal(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="add" size={22} color={Colors.light.tint} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={Colors.light.tint} />}
      >
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <Text style={styles.totalLabel}>Total Spending</Text>
            <Text style={[styles.totalPercent, totalProgress > 0.9 && { color: Colors.light.negative }]}>
              {Math.round(totalProgress * 100)}%
            </Text>
          </View>
          <Text style={styles.totalAmount}>
            ${totalSpent.toFixed(0)} <Text style={styles.totalOf}>of ${totalBudget.toFixed(0)}</Text>
          </Text>
          <View style={styles.totalProgressBg}>
            <View
              style={[
                styles.totalProgressFill,
                {
                  width: `${Math.round(totalProgress * 100)}%`,
                  backgroundColor: totalProgress > 0.9 ? Colors.light.negative : Colors.light.tint,
                },
              ]}
            />
          </View>
        </View>

        {budgets.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => handleEditLimit(category.id)}
            onLongPress={() => handleDelete(category.id)}
          >
            <BudgetBar category={category} />
          </Pressable>
        ))}

        {budgets.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={32} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>No Budgets Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first budget category.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Budget</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.light.text} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g., Groceries"
              placeholderTextColor={Colors.light.textTertiary}
            />

            <Text style={styles.inputLabel}>Monthly Limit ($)</Text>
            <TextInput
              style={styles.input}
              value={newLimit}
              onChangeText={setNewLimit}
              placeholder="500"
              keyboardType="numeric"
              placeholderTextColor={Colors.light.textTertiary}
            />

            <Text style={styles.inputLabel}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.name}
                  style={[styles.iconOption, selectedIcon === opt.name && { backgroundColor: selectedColor + "20", borderColor: selectedColor }]}
                  onPress={() => setSelectedIcon(opt.name)}
                >
                  <MaterialIcons name={opt.name as any} size={22} color={selectedIcon === opt.name ? selectedColor : Colors.light.textSecondary} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <Pressable
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.9 }]}
              onPress={handleAddBudget}
            >
              <Text style={styles.saveButtonText}>Add Budget</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingBudget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Limit</Text>
              <Pressable onPress={() => setEditingBudget(null)}>
                <Ionicons name="close" size={24} color={Colors.light.text} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Monthly Limit ($)</Text>
            <TextInput
              style={styles.input}
              value={newLimit}
              onChangeText={setNewLimit}
              keyboardType="numeric"
              placeholderTextColor={Colors.light.textTertiary}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.9 }]}
              onPress={handleSaveEdit}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.tint + "30",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  totalCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  totalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
  },
  totalPercent: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.tint,
  },
  totalAmount: {
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  totalOf: {
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  totalProgressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.borderLight,
    overflow: "hidden",
  },
  totalProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  budgetCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  budgetInfo: {
    flex: 1,
    gap: 2,
  },
  budgetName: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  budgetRange: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textTertiary,
  },
  budgetPercentWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceElevated,
  },
  budgetPercent: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.tint,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.borderLight,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  budgetRemaining: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.light.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surfaceElevated,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Colors.light.text,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.background,
  },
});
