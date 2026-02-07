import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { apiRequest } from '@/lib/query-client';
import { Ionicons } from '@expo/vector-icons';

export const PigeonTacticalWidget = () => {
    const [loading, setLoading] = useState(true);
    const [riskData, setRiskData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setErrorMsg('Permission to access location was denied');
                    setLoading(false);
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                fetchRiskScore(location.coords.latitude, location.coords.longitude);
            } catch (err) {
                setErrorMsg('Could not fetch location');
                setLoading(false);
            }
        })();
    }, []);

    const fetchRiskScore = async (lat: number, lng: number) => {
        try {
            const res = await apiRequest("GET", `/api/pigeon/risk-score?lat=${lat}&lng=${lng}`);
            const data = await res.json();
            setRiskData(data);
        } catch (err) {
            console.error("Failed to fetch risk score:", err);
            setErrorMsg("Failed to connect to tactical server");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score < 30) return '#00E676';
        if (score < 70) return '#FFEA00';
        return '#FF3D71';
    };

    if (loading) {
        return <View style={styles.container}><ActivityIndicator color="#00F0FF" /></View>;
    }

    if (errorMsg) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Tactical Uplink Offline: {errorMsg}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="location" size={20} color="#00F0FF" />
                <Text style={styles.title}>Tactical Environment Scan</Text>
            </View>

            <View style={styles.scoreRow}>
                <View>
                    <Text style={styles.label}>Temptation Score</Text>
                    <Text style={[styles.scoreValue, { color: getScoreColor(riskData?.temptation_score || 0) }]}>
                        {riskData?.temptation_score || 0}/100
                    </Text>
                </View>
                <View style={styles.limitContainer}>
                    <Text style={styles.label}>Safe Limit</Text>
                    <Text style={styles.limitValue}>${riskData?.safe_limit?.toFixed(0) || '0'}</Text>
                </View>
            </View>

            {riskData?.risk_factors?.length > 0 && (
                <View style={styles.factors}>
                    {riskData.risk_factors.map((factor: string, i: number) => (
                        <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{factor}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1E1E24',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#00F0FF',
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    title: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 16,
        color: '#00F0FF',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    label: {
        fontFamily: 'DMSans_500Medium',
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    scoreValue: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 32,
    },
    limitContainer: {
        alignItems: 'flex-end',
    },
    limitValue: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 24,
        color: '#FFF',
    },
    factors: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: 'rgba(255, 61, 113, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 61, 113, 0.5)',
    },
    tagText: {
        color: '#FF3D71',
        fontFamily: 'DMSans_500Medium',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    errorText: {
        color: '#666',
        fontFamily: 'DMSans_400Regular',
        textAlign: 'center',
    }
});
