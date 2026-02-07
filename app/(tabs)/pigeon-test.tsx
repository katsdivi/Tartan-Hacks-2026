import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { usePigeon } from '@/lib/pigeon-context';
import { pigeonService } from '@/lib/pigeon-service';
import * as Location from 'expo-location';

export default function PigeonTestScreen() {
    const { isDangerZoneMonitoringEnabled, activeDangerZones, enableMonitoring, disableMonitoring } = usePigeon();
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [lastCheckResult, setLastCheckResult] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        getCurrentPosition();
    }, []);

    const getCurrentPosition = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setCurrentLocation({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            });
        } catch (error) {
            console.error('Error getting location:', error);
        }
    };

    const handleCheckNow = async () => {
        setIsChecking(true);
        try {
            const result = await pigeonService.checkCurrentLocation();
            setLastCheckResult(result);

            if (result?.should_notify && result.notification_message) {
                Alert.alert(
                    '⚠️ Spending Alert',
                    result.notification_message,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    '✅ All Clear',
                    `No high-risk zones nearby.\n\nRegret Score: ${result?.regret_score || 0}/100\nRisk Level: ${result?.risk_level || 'unknown'}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to check location');
        } finally {
            setIsChecking(false);
        }
    };

    const [monitoringError, setMonitoringError] = useState<string>('');

    const handleToggleMonitoring = async () => {
        try {
            setMonitoringError('');
            if (isDangerZoneMonitoringEnabled) {
                await disableMonitoring();
                Alert.alert('Monitoring Disabled', 'Pigeon is no longer watching for danger zones');
            } else {
                await enableMonitoring();
                Alert.alert(
                    'Monitoring Enabled',
                    'Pigeon will check your location every 30 seconds while the app is open.\n\n⚠️ Keep the app open for monitoring to work (Expo Go limitation)'
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🐦 Pigeon Test (Expo Go)</Text>
                <Text style={styles.subtitle}>Background geofencing not available - manual testing only</Text>
            </View>

            {/* Current Location */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 Your Location</Text>
                {currentLocation ? (
                    <>
                        <Text style={styles.text}>Lat: {currentLocation.lat.toFixed(6)}</Text>
                        <Text style={styles.text}>Lng: {currentLocation.lng.toFixed(6)}</Text>
                        <TouchableOpacity style={styles.buttonSecondary} onPress={getCurrentPosition}>
                            <Text style={styles.buttonText}>Refresh Location</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.text}>Loading...</Text>
                )}
            </View>

            {/* Monitoring Status */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔔 Monitoring Status</Text>
                <Text style={styles.statusText}>
                    {isDangerZoneMonitoringEnabled ? '🟢 Active (checking every 30s)' : '🔴 Inactive'}
                </Text>
                <TouchableOpacity
                    style={[styles.button, isDangerZoneMonitoringEnabled && styles.buttonDanger]}
                    onPress={handleToggleMonitoring}
                >
                    <Text style={styles.buttonText}>
                        {isDangerZoneMonitoringEnabled ? 'Stop Monitoring' : 'Start Monitoring'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Manual Check */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🧪 Manual Check</Text>
                <TouchableOpacity
                    style={styles.buttonPrimary}
                    onPress={handleCheckNow}
                    disabled={isChecking}
                >
                    <Text style={styles.buttonText}>
                        {isChecking ? 'Checking...' : 'Check Current Location Now'}
                    </Text>
                </TouchableOpacity>
                {lastCheckResult && (
                    <View style={styles.resultBox}>
                        <Text style={styles.resultTitle}>Last Check Result:</Text>
                        <Text style={styles.text}>Regret Score: {lastCheckResult.regret_score}/100</Text>
                        <Text style={styles.text}>Risk Level: {lastCheckResult.risk_level}</Text>
                        <Text style={styles.text}>
                            In Danger Zone: {lastCheckResult.in_danger_zone ? 'Yes' : 'No'}
                        </Text>
                        <Text style={styles.text}>
                            Should Notify: {lastCheckResult.should_notify ? 'Yes' : 'No'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Danger Zones */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗺️ Danger Zones ({activeDangerZones.length})</Text>
                {activeDangerZones.map((zone, index) => {
                    const distance = currentLocation
                        ? calculateDistance(currentLocation.lat, currentLocation.lng, zone.lat, zone.lng)
                        : null;

                    return (
                        <View key={index} style={styles.zoneBox}>
                            <Text style={styles.zoneName}>{zone.merchant_name || zone.id}</Text>
                            <Text style={styles.text}>
                                {zone.merchant_category && `Category: ${zone.merchant_category}`}
                            </Text>
                            <Text style={styles.text}>
                                {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                            </Text>
                            {distance !== null && (
                                <Text style={[styles.text, distance < 100 && styles.textDanger]}>
                                    Distance: {distance.toFixed(0)}m {distance < 50 && '⚠️ INSIDE ZONE'}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Instructions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📖 How to Test</Text>
                <Text style={styles.instruction}>1. Grant location permission when prompted</Text>
                <Text style={styles.instruction}>2. Click "Start Monitoring" above</Text>
                <Text style={styles.instruction}>3. Use "Check Current Location Now" to manually test</Text>
                <Text style={styles.instruction}>4. Or use mock location to simulate being near a danger zone:</Text>
                <Text style={styles.instructionSub}>   • iOS: Use a location spoofing app</Text>
                <Text style={styles.instructionSub}>   • Android: Enable Developer Options → Mock Location</Text>
                <Text style={styles.instruction}>5. Test coordinates: 40.444, -79.943 (The Dive Bar)</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#6366f1',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 14,
        color: '#e0e7ff',
    },
    section: {
        backgroundColor: 'white',
        margin: 15,
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1f2937',
    },
    text: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 5,
    },
    textDanger: {
        color: '#dc2626',
        fontWeight: 'bold',
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1f2937',
    },
    button: {
        backgroundColor: '#10b981',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDanger: {
        backgroundColor: '#ef4444',
    },
    buttonPrimary: {
        backgroundColor: '#6366f1',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonSecondary: {
        backgroundColor: '#6b7280',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resultBox: {
        backgroundColor: '#f3f4f6',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#1f2937',
    },
    zoneBox: {
        backgroundColor: '#fef3c7',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    zoneName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#92400e',
        marginBottom: 5,
    },
    instruction: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 8,
    },
    instructionSub: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 5,
        marginLeft: 10,
    },
});
