"""
Purchase Predictor Service

Provides real-time purchase prediction using the trained XGBoost model
and serves danger zone data from the ML pipeline.

Integrated from: https://github.com/Abhinavvvkk07/pp_roots
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Paths relative to the project root
PROJECT_ROOT = Path(__file__).resolve().parents[1]
PP_ROOT = PROJECT_ROOT / "purchase_predictor"
MODEL_PATH = PP_ROOT / "models" / "purchase_predictor.json"
META_PATH = PP_ROOT / "models" / "purchase_predictor_meta.json"
DANGER_ZONES_PATH = PP_ROOT / "data" / "danger_zones.json"


class PurchasePredictorService:
    """
    Server-side purchase prediction using XGBoost.
    Loads the trained model once and serves predictions via API.
    """

    def __init__(self):
        self.model = None
        self.metadata: Dict[str, Any] = {}
        self.feature_names: List[str] = []
        self.threshold: float = 0.70
        self.danger_zones: List[Dict] = []
        self._loaded = False

    def load(self) -> bool:
        """Load model, metadata, and danger zones. Returns True if successful."""
        if self._loaded:
            return True

        try:
            # Load metadata
            if META_PATH.exists():
                with open(META_PATH) as f:
                    self.metadata = json.load(f)
                self.feature_names = self.metadata.get("feature_names", [])
                self.threshold = self.metadata.get("threshold", 0.70)
                logger.info(f"Loaded model metadata: {len(self.feature_names)} features, threshold={self.threshold}")
            else:
                # Use default feature names if no metadata file
                self.feature_names = [
                    "distance_to_merchant",
                    "hour_of_day",
                    "is_weekend",
                    "budget_utilization",
                    "merchant_regret_rate",
                    "dwell_time",
                ]
                self.threshold = 0.70
                logger.warning("No model metadata found, using defaults")

            # Load XGBoost model (optional — predict will use heuristic fallback if missing)
            if MODEL_PATH.exists():
                try:
                    import xgboost as xgb
                    self.model = xgb.XGBClassifier()
                    self.model.load_model(str(MODEL_PATH))
                    logger.info("XGBoost model loaded successfully")
                except ImportError:
                    logger.warning("xgboost not installed — using heuristic predictor")
                    self.model = None
                except Exception as e:
                    logger.warning(f"Failed to load XGBoost model: {e} — using heuristic predictor")
                    self.model = None
            else:
                logger.warning(f"Model file not found at {MODEL_PATH} — using heuristic predictor")

            # Load danger zones
            if DANGER_ZONES_PATH.exists():
                with open(DANGER_ZONES_PATH) as f:
                    self.danger_zones = json.load(f)
                logger.info(f"Loaded {len(self.danger_zones)} danger zones")
            else:
                self.danger_zones = []
                logger.warning("No danger zones file found")

            self._loaded = True
            return True

        except Exception as e:
            logger.error(f"Failed to load predictor service: {e}")
            return False

    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Predict purchase probability for a single observation.

        Args:
            features: Dict with keys matching self.feature_names
                - distance_to_merchant: meters (0-500)
                - hour_of_day: 0-23
                - is_weekend: 0 or 1
                - budget_utilization: 0.0-1.0
                - merchant_regret_rate: 0.0-1.0
                - dwell_time: seconds (0-600)

        Returns:
            Dict with:
                - probability: float (0.0-1.0)
                - should_nudge: bool
                - risk_level: "low" | "medium" | "high"
                - threshold: float
                - model_type: "xgboost" | "heuristic"
        """
        self.load()

        # Validate and order features
        ordered_values = []
        for fname in self.feature_names:
            val = features.get(fname, 0.0)
            ordered_values.append(float(val))

        if self.model is not None:
            # Use XGBoost model
            try:
                import pandas as pd
                input_df = pd.DataFrame([dict(zip(self.feature_names, ordered_values))])
                proba = float(self.model.predict_proba(input_df)[:, 1][0])
                model_type = "xgboost"
            except Exception as e:
                logger.warning(f"XGBoost prediction failed: {e}, falling back to heuristic")
                proba = self._heuristic_predict(features)
                model_type = "heuristic"
        else:
            # Heuristic fallback (mirrors the labeling logic from generate_data.py)
            proba = self._heuristic_predict(features)
            model_type = "heuristic"

        should_nudge = proba >= self.threshold

        if proba >= 0.80:
            risk_level = "high"
        elif proba >= 0.50:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "probability": round(proba, 4),
            "should_nudge": should_nudge,
            "risk_level": risk_level,
            "threshold": self.threshold,
            "model_type": model_type,
        }

    def _heuristic_predict(self, features: Dict[str, float]) -> float:
        """Fallback heuristic prediction matching the training data labeling logic."""
        score = 0.0

        if features.get("merchant_regret_rate", 0) > 0.7:
            score += 0.4
        if features.get("hour_of_day", 0) > 20:
            score += 0.2
        if features.get("budget_utilization", 0) > 0.8:
            score += 0.3
        if features.get("distance_to_merchant", 500) < 50:
            score += 0.2

        return min(1.0, max(0.0, score))

    def get_danger_zones(self) -> List[Dict[str, Any]]:
        """Return all danger zones with merchant data."""
        if not self._loaded:
            self.load()
        
        # Transform danger zones to match frontend expectations
        transformed_zones = []
        for zone in self.danger_zones:
            transformed_zones.append({
                "id": zone.get("merchant", "unknown"),
                "merchant_name": zone.get("merchant", "Unknown"),
                "lat": zone.get("lat", 0.0),
                "lng": zone.get("lng", 0.0),
                "radius": 50.0,  # Default 50m radius
                "merchant_category": zone.get("category", "Food and Drink"),
                "avg_regret_score": zone.get("regret_count", 0) / 100.0  # Normalize to 0-1
            })
        
        # Add requested global danger zone
        transformed_zones.append({
            "id": "Global Danger Zone",
            "merchant_name": "Area 69",
            "lat": 69.69,
            "lng": 42.00,
            "radius": 500.0,  # Larger radius to make it easier to hit
            "merchant_category": "Restricted Area",
            "avg_regret_score": 1.0  # Max regret
        })
        
        return transformed_zones

    def check_danger_zone(self, lat: float, lng: float, radius_km: float = 0.5) -> Optional[Dict]:
        """
        Check if a coordinate is within a danger zone.

        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Matching radius in km (default 0.5km)

        Returns:
            The matching danger zone dict, or None if not in a zone.
        """
        self.load()
        import math

        for zone in self.danger_zones:
            zone_lat = zone.get("lat", 0)
            zone_lng = zone.get("lng", 0)

            # Haversine approximation for small distances
            dlat = math.radians(lat - zone_lat)
            dlng = math.radians(lng - zone_lng)
            a = (math.sin(dlat / 2) ** 2 +
                 math.cos(math.radians(zone_lat)) * math.cos(math.radians(lat)) *
                 math.sin(dlng / 2) ** 2)
            distance_km = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

            if distance_km <= radius_km:
                return {**zone, "distance_km": round(distance_km, 3)}

        return None

    def predict_for_transaction(
        self,
        distance_meters: float,
        budget_utilization: float,
        merchant_regret_rate: float,
        dwell_time_seconds: float = 0,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        High-level prediction combining model output with danger zone check.
        Convenience method for the API layer.
        """
        now = datetime.now()

        features = {
            "distance_to_merchant": distance_meters,
            "hour_of_day": now.hour,
            "is_weekend": 1 if now.weekday() >= 5 else 0,
            "budget_utilization": budget_utilization,
            "merchant_regret_rate": merchant_regret_rate,
            "dwell_time": dwell_time_seconds,
        }

        prediction = self.predict(features)

        # Add danger zone info if coordinates provided
        danger_zone = None
        if lat is not None and lng is not None:
            danger_zone = self.check_danger_zone(lat, lng)

        if danger_zone:
            prediction["in_danger_zone"] = True
            prediction["danger_zone"] = danger_zone
            # Boost risk if in a danger zone
            if prediction["risk_level"] == "medium":
                prediction["risk_level"] = "high"
            if not prediction["should_nudge"] and prediction["probability"] >= 0.50:
                prediction["should_nudge"] = True
                prediction["nudge_reason"] = "danger_zone_override"
        else:
            prediction["in_danger_zone"] = False
            prediction["danger_zone"] = None

        return prediction


# Module-level singleton
predictor_service = PurchasePredictorService()
