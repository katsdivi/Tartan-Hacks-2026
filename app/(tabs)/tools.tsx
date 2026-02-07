import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SubscriptionMonitor } from '@/components/SubscriptionMonitor';
import { PurchaseSimulator } from '@/components/PurchaseSimulator';
import { PigeonTacticalWidget } from '@/components/PigeonTacticalWidget';
import { PurchaseNudge } from '@/components/PurchaseNudge';
import { DangerZoneAlert } from '@/components/DangerZoneAlert';

export default function ToolsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        <SubscriptionMonitor />
                    </View>

                    <View style={styles.section}>
                        <PurchaseSimulator />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F13',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    headerTitle: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 28,
        color: '#FFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontFamily: 'DMSans_400Regular',
        fontSize: 16,
        color: '#888',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    }
});
