import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useFinance } from '@/lib/finance-context';
import { apiRequest } from '@/lib/query-client';
import { Ionicons } from '@expo/vector-icons';

export const SubscriptionMonitor = () => {
    const { accounts } = useFinance();
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCost, setTotalCost] = useState(0);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (accounts.length > 0) {
            fetchSubscriptions(accounts[0].account_id);
        }
    }, [accounts]);

    const fetchSubscriptions = async (accountId: string) => {
        setLoading(true);
        try {
            const res = await apiRequest("GET", `/api/finance/recurring-payments?account_id=${accountId}`);
            const data = await res.json();
            setSubscriptions(data.suspected_subscriptions || []);
            setTotalCost(data.total_monthly_cost || 0);
        } catch (err) {
            console.error("Failed to fetch subscriptions:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!subscriptions.length && !loading) return null;

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name="repeat" size={24} color="#FF3D71" />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Subscription Monitor</Text>
                    <Text style={styles.subtitle}>
                        {loading ? "Scanning..." : `${subscriptions.length} recurring • $${totalCost.toFixed(2)}/mo`}
                    </Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#666" />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.content}>
                    {loading ? (
                        <ActivityIndicator color="#0066FF" />
                    ) : (
                        subscriptions.map((sub, index) => (
                            <View key={index} style={styles.item}>
                                <View style={styles.itemLeft}>
                                    <Text style={styles.merchant}>{sub.merchant}</Text>
                                    <Text style={styles.frequency}>Detected {sub.frequency_count}x</Text>
                                </View>
                                <Text style={styles.amount}>${sub.amount.toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1E1E24',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 61, 113, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 16,
        color: '#FFF',
    },
    subtitle: {
        fontFamily: 'DMSans_400Regular',
        fontSize: 14,
        color: '#AAA',
        marginTop: 2,
    },
    content: {
        padding: 16,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A35',
    },
    itemLeft: {
        flex: 1,
    },
    merchant: {
        fontFamily: 'DMSans_500Medium',
        fontSize: 15,
        color: '#FFF',
    },
    frequency: {
        fontFamily: 'DMSans_400Regular',
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    amount: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 15,
        color: '#FF3D71',
    },
});
