import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePigeon } from '@/lib/pigeon-context';
import { pigeonService } from '@/lib/pigeon-service';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

export default function PigeonTestScreen() {
    const insets = useSafeAreaInsets();
    const { isDangerZoneMonitoringEnabled, activeDangerZones, enableMonitoring, disableMonitoring } = usePigeon();
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [lastCheckResult, setLastCheckResult] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(false);

    const topInset = Platform.OS === "web" ? 67 : insets.top;

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

    const handleToggleMonitoring = async () => {
        try {
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
        <View style={[styles.container, { paddingTop: topInset }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.iconWrapper}>
                        <Ionicons name="navigate" size={28} color={Colors.light.tint} />
                    </View>
                    <View>
                        <Text style={styles.title}>Pigeon</Text>
                        <Text style={styles.subtitle}>Location-based spending alerts</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Current Location Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: Colors.light.tintLight }]}>
                            <Ionicons name="location" size={18} color={Colors.light.tint} />
                        </View>
                        <Text style={styles.cardTitle}>Your Location</Text>
                    </View>
                    {currentLocation ? (
                        <>
                            <View style={styles.locationRow}>
                                <Text style={styles.locationLabel}>Latitude</Text>
                                <Text style={styles.locationValue}>{currentLocation.lat.toFixed(6)}</Text>
                            </View>
                            <View style={styles.locationRow}>
                                <Text style={styles.locationLabel}>Longitude</Text>
                                <Text style={styles.locationValue}>{currentLocation.lng.toFixed(6)}</Text>
                            </View>
                            <TouchableOpacity style={styles.secondaryButton} onPress={getCurrentPosition}>
                                <Ionicons name="refresh" size={16} color={Colors.light.text} />
                                <Text style={styles.secondaryButtonText}>Refresh Location</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <Text style={styles.loadingText}>Loading location...</Text>
                    )}
                </View>

                {/* Monitoring Status Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: isDangerZoneMonitoringEnabled ? Colors.light.positiveLight : Colors.light.negativeLight }]}>
                            <Ionicons
                                name={isDangerZoneMonitoringEnabled ? "radio" : "radio-outline"}
                                size={18}
                                color={isDangerZoneMonitoringEnabled ? Colors.light.positive : Colors.light.negative}
                            />
                        </View>
                        <Text style={styles.cardTitle}>Monitoring Status</Text>
                    </View>

                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isDangerZoneMonitoringEnabled ? Colors.light.positive : Colors.light.negative }]} />
                        <Text style={styles.statusText}>
                            {isDangerZoneMonitoringEnabled ? 'Active (checking every 30s)' : 'Inactive'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, isDangerZoneMonitoringEnabled && styles.dangerButton]}
                        onPress={handleToggleMonitoring}
                    >
                        <Ionicons
                            name={isDangerZoneMonitoringEnabled ? "stop-circle" : "play-circle"}
                            size={20}
                            color={Colors.light.background}
                        />
                        <Text style={styles.primaryButtonText}>
                            {isDangerZoneMonitoringEnabled ? 'Stop Monitoring' : 'Start Monitoring'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Manual Check Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: Colors.light.neonPurple + '20' }]}>
                            <Ionicons name="scan" size={18} color={Colors.light.neonPurple} />
                        </View>
                        <Text style={styles.cardTitle}>Manual Check</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleCheckNow}
                        disabled={isChecking}
                    >
                        <Ionicons name="locate" size={20} color={Colors.light.background} />
                        <Text style={styles.primaryButtonText}>
                            {isChecking ? 'Checking...' : 'Check Current Location'}
                        </Text>
                    </TouchableOpacity>

                    {lastCheckResult && (
                        <View style={styles.resultBox}>
                            <Text style={styles.resultTitle}>Last Check Result</Text>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Regret Score</Text>
                                <Text style={[styles.resultValue, lastCheckResult.regret_score > 50 && { color: Colors.light.negative }]}>
                                    {lastCheckResult.regret_score}/100
                                </Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Risk Level</Text>
                                <Text style={styles.resultValue}>{lastCheckResult.risk_level}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>In Danger Zone</Text>
                                <Text style={[styles.resultValue, lastCheckResult.in_danger_zone && { color: Colors.light.negative }]}>
                                    {lastCheckResult.in_danger_zone ? 'Yes' : 'No'}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Danger Zones Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: Colors.light.neonYellow + '20' }]}>
                            <Ionicons name="warning" size={18} color={Colors.light.neonYellow} />
                        </View>
                        <Text style={styles.cardTitle}>Danger Zones ({activeDangerZones.length})</Text>
                    </View>

                    {activeDangerZones.length === 0 ? (
                        <Text style={styles.emptyText}>No danger zones detected</Text>
                    ) : (
                        activeDangerZones.map((zone, index) => {
                            const distance = currentLocation
                                ? calculateDistance(currentLocation.lat, currentLocation.lng, zone.lat, zone.lng)
                                : null;
                            const isNearby = distance !== null && distance < 100;

                            return (
                                <View key={index} style={[styles.zoneBox, isNearby && styles.zoneBoxDanger]}>
                                    <Text style={styles.zoneName}>{zone.merchant_name || zone.id}</Text>
                                    {zone.merchant_category && (
                                        <Text style={styles.zoneCategory}>{zone.merchant_category}</Text>
                                    )}
                                    <Text style={styles.zoneCoords}>
                                        {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                                    </Text>
                                    {distance !== null && (
                                        <View style={styles.distanceRow}>
                                            <Ionicons
                                                name={isNearby ? "alert-circle" : "navigate-outline"}
                                                size={14}
                                                color={isNearby ? Colors.light.negative : Colors.light.textSecondary}
                                            />
                                            <Text style={[styles.distanceText, isNearby && styles.distanceTextDanger]}>
                                                {distance.toFixed(0)}m {distance < 50 && '⚠️ INSIDE ZONE'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Instructions Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: Colors.light.neonBlue + '20' }]}>
                            <Ionicons name="book" size={18} color={Colors.light.neonBlue} />
                        </View>
                        <Text style={styles.cardTitle}>How to Test</Text>
                    </View>

                    <View style={styles.instructionList}>
                        <Text style={styles.instruction}>1. Grant location permission when prompted</Text>
                        <Text style={styles.instruction}>2. Click "Start Monitoring" above</Text>
                        <Text style={styles.instruction}>3. Use "Check Current Location" to manually test</Text>
                        <Text style={styles.instruction}>4. Or use mock location to simulate being near a danger zone</Text>
                        <Text style={styles.instructionSub}>• iOS: Use a location spoofing app</Text>
                        <Text style={styles.instructionSub}>• Android: Enable Developer Options → Mock Location</Text>
                        <Text style={styles.instruction}>5. Test coordinates: 40.444, -79.943 (The Dive Bar)</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.light.tintLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontFamily: 'DMSans_700Bold',
        color: Colors.light.text,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textSecondary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: Colors.light.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 17,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.text,
    },
    locationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    locationLabel: {
        fontSize: 14,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textSecondary,
    },
    locationValue: {
        fontSize: 14,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.text,
    },
    loadingText: {
        fontSize: 14,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textTertiary,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: 15,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.text,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.tint,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 14,
        gap: 8,
    },
    primaryButtonText: {
        fontSize: 15,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.background,
    },
    dangerButton: {
        backgroundColor: Colors.light.negative,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.surfaceElevated,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 6,
        marginTop: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontFamily: 'DMSans_500Medium',
        color: Colors.light.text,
    },
    resultBox: {
        backgroundColor: Colors.light.surfaceElevated,
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    resultTitle: {
        fontSize: 13,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.textSecondary,
        marginBottom: 10,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    resultLabel: {
        fontSize: 13,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textTertiary,
    },
    resultValue: {
        fontSize: 13,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.text,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textTertiary,
        textAlign: 'center',
        paddingVertical: 20,
    },
    zoneBox: {
        backgroundColor: Colors.light.surfaceElevated,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    zoneBoxDanger: {
        borderColor: Colors.light.negative,
        backgroundColor: Colors.light.negativeLight,
    },
    zoneName: {
        fontSize: 15,
        fontFamily: 'DMSans_600SemiBold',
        color: Colors.light.text,
        marginBottom: 4,
    },
    zoneCategory: {
        fontSize: 12,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textSecondary,
        marginBottom: 4,
    },
    zoneCoords: {
        fontSize: 12,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textTertiary,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    distanceText: {
        fontSize: 13,
        fontFamily: 'DMSans_500Medium',
        color: Colors.light.textSecondary,
    },
    distanceTextDanger: {
        color: Colors.light.negative,
        fontFamily: 'DMSans_700Bold',
    },
    instructionList: {
        gap: 8,
    },
    instruction: {
        fontSize: 14,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textSecondary,
        lineHeight: 20,
    },
    instructionSub: {
        fontSize: 12,
        fontFamily: 'DMSans_400Regular',
        color: Colors.light.textTertiary,
        marginLeft: 16,
        lineHeight: 18,
    },
});
