import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useFinance } from '@/lib/finance-context';
import { apiRequest } from '@/lib/query-client';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

export const PurchaseSimulator = () => {
    const { accounts } = useFinance();
    const [amount, setAmount] = useState('');
    const [intent, setIntent] = useState('');
    const [desire, setDesire] = useState(5);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSimulate = async () => {
        if (!amount || !accounts.length) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await apiRequest("POST", "/api/finance/simulate-purchase", {
                account_id: accounts[0].account_id,
                amount: parseFloat(amount),
                intent: intent || "Unknown Item",
                desire_score: desire
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error("Simulation failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const getVerdictColor = (v: string) => {
        if (v === "APPROVED") return "#4ade80"; // green
        if (v === "DENIED") return "#ef4444"; // red
        return "#facc15"; // yellow
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Ionicons name="flask" size={24} color={Colors.light.tint} />
                <Text style={styles.title}>Purchase Simulator</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>What are you buying? (Optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. New Headphones, Coffee..."
                    placeholderTextColor="#666"
                    value={intent}
                    onChangeText={setIntent}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Cost ($)</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    value={amount}
                    onChangeText={setAmount}
                />
            </View>

            <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.label}>Desire Level (1-10)</Text>
                    <Text style={{ color: '#888' }}>{desire}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    {[1, 5, 10].map(v => (
                        <Pressable
                            key={v}
                            onPress={() => setDesire(v)}
                            style={[
                                styles.desireBtn,
                                desire === v && { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint }
                            ]}
                        >
                            <Text style={[styles.desireBtnText, desire === v && { color: '#000' }]}>{v}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <Pressable
                style={[styles.simButton, loading && { opacity: 0.7 }]}
                onPress={handleSimulate}
                disabled={loading}
            >
                <Text style={styles.simButtonText}>
                    {loading ? "Analyzing..." : "Simulate Impact"}
                </Text>
            </Pressable>

            {result && (
                <View style={styles.resultBox}>
                    <View style={styles.verdictRow}>
                        <Text style={[styles.verdictTitle, { color: getVerdictColor(result.recommendation) }]}>
                            VERDICT: {result.recommendation}
                        </Text>
                    </View>
                    <Text style={styles.verdictReason}>{result.verdict_reason}</Text>

                    <View style={styles.divider} />

                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Projected Balance:</Text>
                        <Text style={[
                            styles.statValue,
                            result.projected_balance < 0 ? { color: '#ef4444' } : { color: '#fff' }
                        ]}>
                            ${result.projected_balance.toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>AI Category:</Text>
                        <Text style={styles.statValue}>{result.ai_category}</Text>
                    </View>

                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Regret Risk:</Text>
                        <Text style={[
                            styles.statValue,
                            result.predicted_regret > 50 ? { color: '#facc15' } : { color: '#4ade80' }
                        ]}>
                            {result.predicted_regret}%
                        </Text>
                    </View>

                    {result.warnings.length > 0 && (
                        <View style={styles.warningBox}>
                            {result.warnings.map((w: string, i: number) => (
                                <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        color: '#fff',
        fontWeight: 'bold',
        fontFamily: 'DMSans_700Bold',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: '#aaa',
        marginBottom: 8,
        fontSize: 14,
        fontFamily: 'DMSans_500Medium',
    },
    input: {
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'DMSans_400Regular',
        borderWidth: 1,
        borderColor: '#444',
    },
    desireBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#555',
        backgroundColor: '#2a2a2a'
    },
    desireBtnText: {
        color: '#fff',
        fontWeight: 'bold'
    },
    simButton: {
        backgroundColor: Colors.light.tint,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    simButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
        fontFamily: 'DMSans_700Bold',
    },
    resultBox: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#252525',
        borderRadius: 12,
    },
    verdictRow: {
        alignItems: 'center',
        marginBottom: 4,
    },
    verdictTitle: {
        fontSize: 20,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    verdictReason: {
        color: '#ccc',
        textAlign: 'center',
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginVertical: 12,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statLabel: {
        color: '#888',
        fontSize: 14,
    },
    statValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    warningBox: {
        marginTop: 12,
        padding: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: 8,
    },
    warningText: {
        color: '#ef4444',
        fontSize: 13,
    }
});
