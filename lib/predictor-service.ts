/**
 * Purchase Predictor API Client
 *
 * Communicates with the /api/predictor/* backend endpoints
 * to provide purchase prediction and danger zone awareness.
 *
 * Integrated from: https://github.com/Abhinavvvkk07/pp_roots
 */

import { apiRequest } from "@/lib/query-client";

export interface DangerZone {
  merchant: string;
  lat: number;
  lng: number;
  regret_count: number;
  distance_km?: number;
  address?: string;
}

export interface PurchasePrediction {
  probability: number;
  should_nudge: boolean;
  risk_level: "low" | "medium" | "high";
  threshold: number;
  model_type: "xgboost" | "heuristic";
  in_danger_zone?: boolean;
  danger_zone?: DangerZone | null;
  nudge_reason?: string;
}

export interface PredictionInput {
  distance_to_merchant: number;
  budget_utilization: number;
  merchant_regret_rate: number;
  dwell_time?: number;
  lat?: number;
  lng?: number;
}

/**
 * Fetch all identified danger zones from the server.
 */
export async function fetchDangerZones(): Promise<DangerZone[]> {
  try {
    const res = await apiRequest("GET", "/api/predictor/danger-zones");
    const data = await res.json();
    return data.danger_zones || [];
  } catch (e) {
    console.warn("Failed to fetch danger zones:", e);
    return [];
  }
}

/**
 * Run a purchase prediction for a single scenario.
 */
export async function predictPurchase(
  input: PredictionInput
): Promise<PurchasePrediction | null> {
  try {
    const res = await apiRequest("POST", "/api/predictor/predict", input);
    return await res.json();
  } catch (e) {
    console.warn("Failed to predict purchase:", e);
    return null;
  }
}

/**
 * Check if a geographic coordinate falls within a danger zone.
 */
export async function checkLocation(
  lat: number,
  lng: number
): Promise<{ in_danger_zone: boolean; danger_zone: DangerZone | null }> {
  try {
    const res = await apiRequest("POST", "/api/predictor/check-location", {
      lat,
      lng,
    });
    return await res.json();
  } catch (e) {
    console.warn("Failed to check location:", e);
    return { in_danger_zone: false, danger_zone: null };
  }
}

/**
 * Batch predict for multiple transaction scenarios at once.
 */
export async function batchPredict(
  transactions: Array<{
    transaction_id?: string;
    distance_to_merchant?: number;
    hour_of_day?: number;
    is_weekend?: number;
    budget_utilization?: number;
    merchant_regret_rate?: number;
    dwell_time?: number;
  }>
): Promise<PurchasePrediction[]> {
  try {
    const res = await apiRequest("POST", "/api/predictor/batch-predict", {
      transactions,
    });
    const data = await res.json();
    return data.predictions || [];
  } catch (e) {
    console.warn("Failed to batch predict:", e);
    return [];
  }
}
