/**
 * Pigeon Geofencing Service
 * 
 * Cross-platform geolocation monitoring for behavioral risk detection.
 * Uses expo-location and expo-task-manager for battery-efficient background tracking.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'pigeon-geofence-task';
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

    private constructor() {
        this.apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5001';
    }

    public static getInstance(): PigeonService {
        if (!PigeonService.instance) {
            PigeonService.instance = new PigeonService();
        }
        return PigeonService.instance;
    }

    /**
     * Request necessary permissions for background location tracking
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

            // Request background location permission (critical for geofencing)
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                console.warn('Background location permission not granted');
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
            const response = await fetch(`${this.apiBaseUrl}/api/pigeon/danger-zones`);
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
     * Start monitoring danger zones with geofencing
     */
    async startMonitoring(budgetUtilization: number): Promise<void> {
        try {
            const hasPermissions = await this.requestPermissions();
            if (!hasPermissions) {
                throw new Error('Required permissions not granted');
            }

            // Fetch danger zones
            const zones = await this.fetchDangerZones();
            if (zones.length === 0) {
                console.warn('No danger zones configured');
                return;
            }

            console.log(`🗺️ Pigeon: Monitoring ${zones.length} danger zones`);

            // Define the geofencing task
            if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
                TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
                    if (error) {
                        console.error('Geofence task error:', error);
                        return;
                    }

                    const locationData = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion };

                    if (locationData.eventType === Location.GeofencingEventType.Enter) {
                        console.log('🚨 Entered danger zone:', locationData.region.identifier);
                        await this.handleGeofenceEntry(locationData.region, budgetUtilization);
                    }
                });
            }

            // Register geofences for all danger zones
            const geofenceRegions: Location.LocationRegion[] = zones.map(zone => ({
                identifier: zone.merchant_name || zone.id,
                latitude: zone.lat,
                longitude: zone.lng,
                radius: zone.radius || 50, // Default 50m
                notifyOnEnter: true,
                notifyOnExit: false,
            }));

            await Location.startGeofencingAsync(LOCATION_TASK_NAME, geofenceRegions);
            console.log('✅ Pigeon monitoring started');
        } catch (error) {
            console.error('Error starting Pigeon monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop monitoring
     */
    async stopMonitoring(): Promise<void> {
        try {
            const hasTask = await Location.hasStartedGeofencingAsync(LOCATION_TASK_NAME);
            if (hasTask) {
                await Location.stopGeofencingAsync(LOCATION_TASK_NAME);
                console.log('🛑 Pigeon monitoring stopped');
            }
        } catch (error) {
            console.error('Error stopping Pigeon monitoring:', error);
        }
    }

    /**
   * Handle geofence entry event
   */
    private async handleGeofenceEntry(region: Location.LocationRegion, budgetUtilization: number): Promise<void> {
        try {
            // Debounce notifications (max 1 per zone per minute)
            const now = Date.now();
            const zoneId = region.identifier || 'unknown';
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
                    lat: region.latitude,
                    lng: region.longitude,
                    budgetUtilization,
                    merchantCategory: 'Unknown', // Can be enriched from zone data
                }),
            });

            if (!response.ok) {
                throw new Error(`Location check failed: ${response.statusText}`);
            }

            const result: LocationCheckResponse = await response.json();

            // If we should notify, send local notification
            if (result.should_notify && result.notification_message) {
                await this.sendNotification(
                    zoneId,
                    result.notification_message,
                    result.intervention_id
                );
                this.lastNotificationTime[zoneId] = now;
            }
        } catch (error) {
            console.error('Error handling geofence entry:', error);
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
     * Check if monitoring is active
     */
    async isMonitoring(): Promise<boolean> {
        try {
            return await Location.hasStartedGeofencingAsync(LOCATION_TASK_NAME);
        } catch {
            return false;
        }
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
}

// Export singleton instance
export const pigeonService = PigeonService.getInstance();

// Setup notification response handler (for when user taps notification)
export function setupNotificationHandler(
    onNotificationTap: (interventionId: number | undefined, zoneName: string) => void
) {
    Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data.type === 'pigeon-intervention' && data.interventionId) {
            onNotificationTap(data.interventionId, data.zoneName);
        }
    });
}
