/**
 * Pigeon Geofencing Service - EXPO GO COMPATIBLE VERSION
 * 
 * This version uses foreground location polling instead of background geofencing
 * since Expo Go doesn't support TaskManager geofencing.
 * 
 * FOR TESTING ONLY - not battery efficient (polls every 30 seconds)
 */

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const NOTIFICATION_DEBOUNCE_MS = 60000; // 1 minute minimum between notifications

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface DangerZone {
    id: string;
    merchant_name: string;
    lat: number;
    lng: number;
    radius: number;
    merchant_category?: string;
    avg_regret_score?: number;
}

interface LocationCheckResponse {
    monitoring_enabled: boolean;
    in_danger_zone: boolean;
    danger_zone?: any;
    predicted_probability: number;
    regret_score: number;
    risk_level: 'low' | 'medium' | 'high';
    should_notify: boolean;
    notification_message?: string;
    intervention_id?: number;
}

class PigeonService {
    private static instance: PigeonService;
    private lastNotificationTime: Record<string, number> = {};
    private apiBaseUrl: string;
    private locationSubscription: Location.LocationSubscription | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private dangerZones: DangerZone[] = [];
    private budgetUtilization: number = 0.5;

    private constructor() {
        // Use the environment variable, or fallback to the specific IP if needed for testing
        this.apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://172.25.4.240:5001';
        console.log(`🐦 [Pigeon] Service initialized with API URL: ${this.apiBaseUrl}`);
    }

    public static getInstance(): PigeonService {
        if (!PigeonService.instance) {
            PigeonService.instance = new PigeonService();
        }
        return PigeonService.instance;
    }

    /**
     * Request necessary permissions (foreground only for Expo Go)
     */
    async requestPermissions(): Promise<boolean> {
        try {
            // Request notification permissions
            const { status: notifStatus } = await Notifications.requestPermissionsAsync();
            if (notifStatus !== 'granted') {
                console.warn('Notification permission not granted');
                return false;
            }

            // Request foreground location permission
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                console.warn('Foreground location permission not granted');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error requesting permissions:', error);
            return false;
        }
    }

    /**
     * Fetch danger zones from backend
     */
    async fetchDangerZones(): Promise<DangerZone[]> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/predictor/danger-zones`);
            if (!response.ok) {
                throw new Error(`Failed to fetch danger zones: ${response.statusText}`);
            }
            const data = await response.json();
            return data.danger_zones || [];
        } catch (error) {
            console.error('Error fetching danger zones:', error);
            return [];
        }
    }

    /**
     * Start monitoring (foreground polling for Expo Go)
     */
    async startMonitoring(budgetUtilization: number): Promise<void> {
        try {
            console.log('🐦 [Pigeon] Requesting permissions...');
            const hasPermissions = await this.requestPermissions();
            if (!hasPermissions) {
                throw new Error('Location or notification permissions not granted. Please enable in Settings.');
            }

            console.log('✅ [Pigeon] Permissions granted');
            this.budgetUtilization = budgetUtilization;

            // Fetch danger zones
            console.log('🗺️ [Pigeon] Fetching danger zones...');
            this.dangerZones = await this.fetchDangerZones();
            if (this.dangerZones.length === 0) {
                console.warn('⚠️ [Pigeon] No danger zones configured');
                throw new Error('No danger zones configured on the server');
            }

            console.log(`📍 [EXPO GO MODE] Monitoring ${this.dangerZones.length} danger zones`);
            console.log('⚠️ App must stay open for monitoring to work');

            // Start watching position (foreground only)
            console.log('👀 [Pigeon] Starting location watch...');
            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: CHECK_INTERVAL_MS,
                    distanceInterval: 50, // Update every 50m
                },
                async (location) => {
                    await this.checkNearbyDangerZones(location.coords);
                }
            );

            console.log('✅ Pigeon monitoring started (foreground mode)');
        } catch (error) {
            console.error('❌ [Pigeon] Error starting monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop monitoring
     */
    async stopMonitoring(): Promise<void> {
        try {
            if (this.locationSubscription) {
                this.locationSubscription.remove();
                this.locationSubscription = null;
            }
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            console.log('🛑 Pigeon monitoring stopped');
        } catch (error) {
            console.error('Error stopping Pigeon monitoring:', error);
        }
    }

    /**
     * Check if near any danger zones
     */
    private async checkNearbyDangerZones(coords: { latitude: number; longitude: number }): Promise<void> {
        for (const zone of this.dangerZones) {
            const distance = this.calculateDistance(
                coords.latitude,
                coords.longitude,
                zone.lat,
                zone.lng
            );

            if (distance < (zone.radius || 50)) {
                console.log(`🚨 Near danger zone: ${zone.merchant_name} (${distance.toFixed(0)}m away)`);
                await this.handleDangerZoneProximity(zone, coords);
            }
        }
    }

    /**
     * Handle being near a danger zone
     */
    private async handleDangerZoneProximity(
        zone: DangerZone,
        coords: { latitude: number; longitude: number }
    ): Promise<void> {
        try {
            // Debounce notifications
            const now = Date.now();
            const zoneId = zone.merchant_name || zone.id;
            const lastNotification = this.lastNotificationTime[zoneId];
            if (lastNotification && (now - lastNotification) < NOTIFICATION_DEBOUNCE_MS) {
                console.log('⏭️ Skipping notification (debounced)');
                return;
            }

            // Check location with backend
            const response = await fetch(`${this.apiBaseUrl}/api/pigeon/check-location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: coords.latitude,
                    lng: coords.longitude,
                    budgetUtilization: this.budgetUtilization,
                    merchantCategory: zone.merchant_category || 'Unknown',
                }),
            });

            if (!response.ok) {
                throw new Error(`Location check failed: ${response.statusText}`);
            }

            const result: LocationCheckResponse = await response.json();

            // If we should notify, send notification
            if (result.should_notify && result.notification_message) {
                await this.sendNotification(
                    zoneId,
                    result.notification_message,
                    result.intervention_id
                );
                this.lastNotificationTime[zoneId] = now;
            }
        } catch (error) {
            console.error('Error handling danger zone proximity:', error);
        }
    }

    /**
     * Send local notification
     */
    private async sendNotification(
        zoneName: string,
        message: string,
        interventionId?: number
    ): Promise<void> {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `⚠️ Spending Alert: ${zoneName}`,
                    body: message,
                    sound: 'default',
                    data: {
                        type: 'pigeon-intervention',
                        interventionId,
                        zoneName,
                    },
                },
                trigger: null, // Send immediately
            });
            console.log('📬 Notification sent');
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    /**
     * Check if monitoring is active
     */
    async isMonitoring(): Promise<boolean> {
        return this.locationSubscription !== null;
    }

    /**
     * Submit feedback for an intervention
     */
    async submitFeedback(interventionId: number, response: 'helpful' | 'not_helpful' | 'ignored'): Promise<void> {
        try {
            await fetch(`${this.apiBaseUrl}/api/pigeon/intervention-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intervention_id: interventionId,
                    user_response: response,
                }),
            });
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }

    /**
     * Manual location check (for testing button)
     */
    async checkCurrentLocation(): Promise<LocationCheckResponse | null> {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const response = await fetch(`${this.apiBaseUrl}/api/pigeon/check-location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    budgetUtilization: this.budgetUtilization,
                    merchantCategory: 'Food and Drink',
                }),
            });

            if (!response.ok) {
                throw new Error(`Location check failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error checking current location:', error);
            return null;
        }
    }
}

// Export singleton instance
export const pigeonService = PigeonService.getInstance();

// Setup notification response handler
export function setupNotificationHandler(
    onNotificationTap: (interventionId: number | undefined, zoneName: string) => void
) {
    Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data.type === 'pigeon-intervention') {
            onNotificationTap(data.interventionId, data.zoneName);
        }
    });
}
