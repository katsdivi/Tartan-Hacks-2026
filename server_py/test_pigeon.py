"""
Test suite for Pigeon geo-behavioral risk detection endpoints
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add server_py to path
sys.path.insert(0, str(Path(__file__).parent))

from main import app
import database

client = TestClient(app)


class TestPigeonDangerZones:
    def test_get_danger_zones(self):
        """Test GET /api/pigeon/danger-zones"""
        response = client.get("/api/pigeon/danger-zones")
        assert response.status_code == 200
        data = response.json()
        assert "danger_zones" in data
        assert "count" in data
        assert isinstance(data["danger_zones"], list)


class TestPigeonSettings:
    def test_get_default_settings(self):
        """Test GET /api/pigeon/settings returns defaults"""
        response = client.get("/api/pigeon/settings")
        assert response.status_code == 200
        settings = response.json()
        assert "monitoring_enabled" in settings
        assert "notification_threshold" in settings
        assert settings["notification_threshold"] == 0.70
    
    def test_update_settings(self):
        """Test POST /api/pigeon/settings"""
        new_settings = {
            "monitoring_enabled": True,
            "notification_threshold": 0.80,
            "proximity_radius_meters": 100.0
        }
        response = client.post("/api/pigeon/settings", json=new_settings)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["settings"]["monitoring_enabled"] is True
        assert data["settings"]["notification_threshold"] == 0.80


class TestPigeonLocationCheck:
    def test_check_location_without_monitoring(self):
        """Test that check-location returns disabled when monitoring is off"""
        # Ensure monitoring is disabled
        client.post("/api/pigeon/settings", json={"monitoring_enabled": False})
        
        response = client.post("/api/pigeon/check-location", json={
            "lat": 40.444,
            "lng": -79.943,
            "budgetUtilization": 0.95
        })
        assert response.status_code == 200
        data = response.json()
        assert data["monitoring_enabled"] is False
        assert data["should_notify"] is False
    
    def test_check_location_missing_coords(self):
        """Test that check-location requires lat/lng"""
        response = client.post("/api/pigeon/check-location", json={
            "budgetUtilization": 0.95
        })
        assert response.status_code == 400
    
    def test_check_location_with_monitoring(self):
        """Test full location check flow when monitoring is enabled"""
        # Enable monitoring
        client.post("/api/pigeon/settings", json={"monitoring_enabled": True})
        
        response = client.post("/api/pigeon/check-location", json={
            "lat": 40.444,
            "lng": -79.943,
            "budgetUtilization": 0.95,
            "merchantCategory": "Food and Drink"
        })
        assert response.status_code == 200
        data = response.json()
        assert "predicted_probability" in data
        assert "regret_score" in data
        assert "risk_level" in data
        assert data["monitoring_enabled"] is True
        
        # Score should be 0-100
        assert 0 <= data["regret_score"] <= 100


class TestPigeonInterventions:
    def test_log_intervention(self):
        """Test POST /api/pigeon/log-intervention"""
        intervention_data = {
            "danger_zone_id": "test_zone",
            "latitude": 40.444,
            "longitude": -79.943,
            "predicted_probability": 0.85,
            "predicted_score": 85,
            "risk_level": "high",
            "merchant_category": "Food",
            "budget_utilization": 0.90,
            "hour_of_day": 23,
            "notification_sent": True,
            "notification_message": "Test notification"
        }
        response = client.post("/api/pigeon/log-intervention", json=intervention_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "intervention_id" in data
        return data["intervention_id"]
    
    def test_intervention_feedback(self):
        """Test POST /api/pigeon/intervention-feedback"""
        # First log an intervention
        intervention_data = {
            "danger_zone_id": "test_zone_2",
            "latitude": 40.444,
            "longitude": -79.943,
            "predicted_probability": 0.75,
            "predicted_score": 75,
            "risk_level": "high"
        }
        log_response = client.post("/api/pigeon/log-intervention", json=intervention_data)
        intervention_id = log_response.json()["intervention_id"]
        
        # Now submit feedback
        feedback_response = client.post("/api/pigeon/intervention-feedback", json={
            "intervention_id": intervention_id,
            "user_response": "helpful"
        })
        assert feedback_response.status_code == 200
        assert feedback_response.json()["success"] is True


class TestPredictorService:
    def test_predictor_integration(self):
        """Test that predictor service is loaded and working"""
        from predictor_service import predictor_service
        
        # Test prediction
        features = {
            "distance_to_merchant": 25.0,
            "hour_of_day": 22,
            "is_weekend": 1,
            "budget_utilization": 0.90,
            "merchant_regret_rate": 0.75,
            "dwell_time": 0
        }
        prediction = predictor_service.predict(features)
        
        assert "probability" in prediction
        assert "should_nudge" in prediction
        assert "risk_level" in prediction
        assert 0.0 <= prediction["probability"] <= 1.0


class TestDatabaseFunctions:
    def test_pigeon_settings_crud(self):
        """Test Pigeon settings database functions"""
        # Update settings
        database.update_pigeon_user_settings(
            monitoring_enabled=True,
            notification_threshold=0.85
        )
        
        # Retrieve settings
        settings = database.get_pigeon_user_settings()
        assert settings["monitoring_enabled"] is True
        assert settings["notification_threshold"] == 0.85
    
    def test_intervention_logging(self):
        """Test intervention database functions"""
        # Save intervention
        intervention_id = database.save_pigeon_intervention(
            danger_zone_id="test_db_zone",
            latitude=40.5,
            longitude=-79.9,
            predicted_probability=0.80,
            predicted_score=80,
            risk_level="high"
        )
        assert intervention_id > 0
        
        # Update with feedback
        database.update_pigeon_intervention_response(intervention_id, "helpful")
        # No error means success


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
