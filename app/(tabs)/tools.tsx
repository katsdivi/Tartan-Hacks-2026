import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscriptionMonitor } from '@/components/SubscriptionMonitor';
import { PurchaseSimulator } from '@/components/PurchaseSimulator';
import { PigeonTacticalWidget } from '@/components/PigeonTacticalWidget';
import { PurchaseNudge } from '@/components/PurchaseNudge';
import { DangerZoneAlert } from '@/components/DangerZoneAlert';
import Colors from '@/constants/colors';

export default function ToolsScreen() {
    const insets = useSafeAreaInsets();
    const topInset = Platform.OS === "web" ? 67 : insets.top;

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.headerTitle}>Smart Tools</Text>
                    <Text style={styles.headerSubtitle}>
                        Advanced diagnostics & tactical risk assessment.
                    </Text>

                    <View style={styles.section}>
                        <PigeonTacticalWidget />
                    </View>

                    <View style={styles.section}>
                        <PurchaseNudge />
                    </View>

                    <View style={styles.section}>
                        <DangerZoneAlert />
                    </View>

                    <View style={styles.section}>
                        <SubscriptionMonitor />
                    </View>

                    <View style={styles.section}>
                        <PurchaseSimulator />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },
    headerTitle: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 32,
        color: Colors.light.text,
        marginBottom: 6,
    },
    headerSubtitle: {
        fontFamily: 'DMSans_400Regular',
        fontSize: 16,
        color: Colors.light.textSecondary,
        marginBottom: 28,
    },
    section: {
        marginBottom: 16,
    },
});
