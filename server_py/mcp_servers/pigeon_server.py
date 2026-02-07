import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add parent directory to path to import predictor_service
sys.path.append(str(Path(__file__).parent.parent))

from predictor_service import predictor_service
from dedalus_mcp import MCPServer

# Initialize server
server = MCPServer("Pigeon Tactical Risk Server")

@server.tool()
async def scan_environment_risks(lat: float, lng: float, budget_utilization: float = 0.5) -> Dict[str, Any]:
    """
    Scans the current physical environment for spending risks.
    Combines geo-fencing with time-of-day analysis.
    Returns a 'Temptation Score' and specific risk factors.
    """
    try:
        predictor_service.load()
        
        # Base prediction
        # We assume a default context if not provided
        base_prediction = predictor_service.predict_for_transaction(
            distance_meters=10.0,
            budget_utilization=budget_utilization,
            merchant_regret_rate=0.5, # Median risk
            lat=lat,
            lng=lng
        )
        
        # Calculate 'Temptation Score' (0-100)
        # Base probability is 0-1.
        temptation_score = int(base_prediction['probability'] * 100)
        
        # Enhance with specific risk factors
        risk_factors = []
        now = datetime.now()
        
        if 22 <= now.hour or now.hour < 5:
            risk_factors.append("Late Night (Impulse Control Low)")
            temptation_score += 10
            
        if now.weekday() >= 5: # Weekend
            risk_factors.append("Weekend Mode")
            
        if base_prediction['in_danger_zone']:
            zone_name = base_prediction.get('danger_zone', {}).get('merchant_name', 'Unknown')
            risk_factors.append(f"Inside Danger Zone: {zone_name}")
            temptation_score += 20
            
        # Cap score
        temptation_score = min(100, temptation_score)
        
        return {
            "temptation_score": temptation_score,
            "risk_level": "CRITICAL" if temptation_score > 80 else ("HIGH" if temptation_score > 50 else "LOW"),
            "risk_factors": risk_factors,
            "recommended_tone": "STERN" if temptation_score > 70 else "CASUAL"
        }
    except Exception as e:
        return {"error": str(e)}

@server.tool()
async def get_safe_spending_limit(lat: float, lng: float, current_balance: float) -> Dict[str, Any]:
    """
    Recommends a safe spending limit for the current location.
    If in a danger zone, the limit is stricter.
    """
    try:
        # Check risk
        risk_scan = await scan_environment_risks(lat, lng)
        risk_score = risk_scan.get('temptation_score', 0)
        
        # Heuristic for safe limit
        # Low risk: 10% of balance
        # High risk: 1% of balance or $20, whichever is lower
        
        if risk_score > 70:
            safe_limit = min(20.0, current_balance * 0.01)
            reason = "High risk environment detected. Strict limit applied."
        elif risk_score > 40:
            safe_limit = min(50.0, current_balance * 0.05)
            reason = "Moderate risk. Standard caution advised."
        else:
            safe_limit = current_balance * 0.10
            reason = "Low risk environment. Standard budgeting applies."
            
        return {
            "safe_spending_limit": round(safe_limit, 2),
            "reason": reason,
            "context_score": risk_score
        }
    except Exception as e:
        return {"error": str(e)}

@server.resource("pigeon://tactical/current-risk")
async def current_risk_resource():
    """Resource exposing the current calculated risk level for the user's last known location."""
    # In a real app, we'd fetch the last known location from DB
    # For now, we return a placeholder or need to accept params (which resources don't well)
    return {"status": "Needs location to calculate"}

if __name__ == "__main__":
    server.run()
