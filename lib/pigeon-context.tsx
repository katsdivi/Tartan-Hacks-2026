/**
 * Pigeon Context Provider
 * 
 * React context for managing Pigeon geo-behavioral monitoring state
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pigeonService, DangerZone, setupNotificationHandler } from './pigeon-service';
import { useFinance } from './finance-context';

interface PigeonSettings {
    monitoring_enabled: boolean;
    notification_threshold: number;
    proximity_radius_meters: number;
    quiet_hours_start: number;
    quiet_hours_end: number;
}

interface PigeonContextType {
    // State
    isDangerZoneMonitoringEnabled: boolean;
    activeDangerZones: DangerZone[];
    settings: PigeonSettings | null;
    isLoading: boolean;

    // Actions
    enableMonitoring: () => Promise<void>;
    disableMonitoring: () => Promise<void>;
    refreshDangerZones: () => Promise<void>;
    updateSettings: (newSettings: Partial<PigeonSettings>) => Promise<void>;
    submitInterventionFeedback: (interventionId: number, response: 'helpful' | 'not_helpful' | 'ignored') => Promise<void>;
}

const PigeonContext = createContext<PigeonContextType | undefined>(undefined);

export function PigeonProvider({ children }: { children: React.ReactNode }) {
    const [isDangerZoneMonitoringEnabled, setIsDangerZoneMonitoringEnabled] = useState(false);
    const [activeDangerZones, setActiveDangerZones] = useState<DangerZone[]>([]);
    const [settings, setSettings] = useState<PigeonSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { totalNetWorth, budgets } = useFinance();

    // Calculate budget utilization
    const calculateBudgetUtilization = useCallback((): number => {
        if (budgets.length === 0) return 0.5; // Default if no budgets

        const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

        return totalLimit > 0 ? totalSpent / totalLimit : 0.5;
    }, [budgets]);

    // Fetch settings on mount
    useEffect(() => {
        fetchSettings();
        refreshDangerZones();
        checkMonitoringStatus();
    }, []);

    const fetchSettings = async () => {
        try {
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://172.25.4.240:5001';
            const response = await fetch(`${apiBaseUrl}/api/pigeon/settings`);
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
                setIsDangerZoneMonitoringEnabled(data.monitoring_enabled);
            }
        } catch (error) {
            console.error('Error fetching Pigeon settings:', error);
        }
    };

    const refreshDangerZones = async () => {
        try {
            const zones = await pigeonService.fetchDangerZones();
            setActiveDangerZones(zones);
        } catch (error) {
            console.error('Error refreshing danger zones:', error);
        }
    };

    const checkMonitoringStatus = async () => {
        const isActive = await pigeonService.isMonitoring();
        setIsDangerZoneMonitoringEnabled(isActive);
    };

    const enableMonitoring = async () => {
        setIsLoading(true);
        try {
            const budgetUtil = calculateBudgetUtilization();
            await pigeonService.startMonitoring(budgetUtil);

            // Update backend settings
            await updateSettings({ monitoring_enabled: true });
            setIsDangerZoneMonitoringEnabled(true);
        } catch (error) {
            console.error('Error enabling monitoring:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const disableMonitoring = async () => {
        setIsLoading(true);
        try {
            await pigeonService.stopMonitoring();

            // Update backend settings
            await updateSettings({ monitoring_enabled: false });
            setIsDangerZoneMonitoringEnabled(false);
        } catch (error) {
            console.error('Error disabling monitoring:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<PigeonSettings>) => {
        try {
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://172.25.4.240:5001';
            const response = await fetch(`${apiBaseUrl}/api/pigeon/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings),
            });

            if (response.ok) {
                const data = await response.json();
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    };

    const submitInterventionFeedback = async (
        interventionId: number,
        response: 'helpful' | 'not_helpful' | 'ignored'
    ) => {
        try {
            await pigeonService.submitFeedback(interventionId, response);
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };

    const value: PigeonContextType = {
        isDangerZoneMonitoringEnabled,
        activeDangerZones,
        settings,
        isLoading,
        enableMonitoring,
        disableMonitoring,
        refreshDangerZones,
        updateSettings,
        submitInterventionFeedback,
    };

    return <PigeonContext.Provider value={value}>{children}</PigeonContext.Provider>;
}

export function usePigeon() {
    const context = useContext(PigeonContext);
    if (!context) {
        throw new Error('usePigeon must be used within a PigeonProvider');
    }
    return context;
}
