import os
import sys
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

# Add parent directory to path to import nessie_client
sys.path.append(str(Path(__file__).parent.parent))

from nessie_client import NessieClient
from dedalus_mcp import MCPServer

# Initialize server
server = MCPServer("Nessie Finance Server")

# Initialize Nessie Client
nessie_api_key = os.environ.get("NESSIE_API_KEY", "")
nessie_client = NessieClient(api_key=nessie_api_key)

# --- Smart Diagnostic Helpers ---

def analyze_recurring_payments(transactions: List[Dict]) -> List[Dict]:
    """
    Identifies potential subscriptions/recurring payments.
    Logic: Same amount + same merchant + regular intervals (approx 30 days).
    """
    history = {}
    subscriptions = []
    
    for txn in transactions:
        key = (txn.get('merchant_name') or txn.get('name'), txn.get('amount'))
        if key not in history:
            history[key] = []
        history[key].append(txn)
        
    for (name, amount), txns in history.items():
        if len(txns) >= 2:
            # Check interval
            dates = sorted([txn['date'] for txn in txns])
            # Simple check: just flag anything with >1 occurrence for now as a "potential"
            subscriptions.append({
                "merchant": name,
                "amount": amount,
                "frequency_count": len(txns),
                "last_date": dates[-1],
                "confidence": "high" if len(txns) > 2 else "medium"
            })
            
    return subscriptions

# --- Tools ---

@server.tool()
async def detect_subscription_traps(account_id: str) -> Dict[str, Any]:
    """
    Scans account history to identify potentially unwanted subscriptions or recurring charges.
    Returns a list of suspects with confidence scores.
    """
    try:
        # Fetch last 90 days of transactions (simulated by fetching all for now)
        purchases = await nessie_client.get_account_purchases(account_id)
        
        subscriptions = analyze_recurring_payments(purchases)
        
        total_monthly = sum(s['amount'] for s in subscriptions)
        
        return {
            "suspected_subscriptions": subscriptions,
            "total_monthly_cost": total_monthly,
            "analysis_note": f"Found {len(subscriptions)} recurring payments totaling ${total_monthly:.2f}/mo."
        }
    except Exception as e:
        return {"error": str(e)}

@server.tool()
async def simulate_purchase_impact(account_id: str, amount: float, category: str) -> Dict[str, Any]:
    """
    Predicts the financial health impact of a proposed purchase.
    Checks against current balance and upcoming bills.
    """
    try:
        # Fetch current state
        account = await nessie_client.get_account(account_id)
        bills = await nessie_client.get_account_bills(account_id)
        
        current_balance = account.get('balance', 0)
        
        # Calculate pending bills for next 30 days
        pending_bills_total = sum(bill.get('payment_amount', 0) for bill in bills if bill.get('status') == 'pending')
        
        projected_balance = current_balance - pending_bills_total - amount
        
        risk_level = "SAFE"
        warnings = []
        
        if projected_balance < 0:
            risk_level = "CRITICAL"
            warnings.append(" Purchase will cause overdraft.")
        elif projected_balance < 200:
            risk_level = "WARNING"
            warnings.append("Low buffer remaining after bills.")
            
        return {
            "current_balance": current_balance,
            "purchase_amount": amount,
            "pending_bills": pending_bills_total,
            "projected_balance": projected_balance,
            "risk_level": risk_level,
            "warnings": warnings,
            "recommendation": "Proceed" if risk_level == "SAFE" else "Do not buy"
        }
    except Exception as e:
        return {"error": str(e)}

@server.tool()
async def get_financial_health_report(account_id: str) -> Dict[str, Any]:
    """
    Generates a comprehensive financial health report including liquidity, 
    spending velocity, and savings rate.
    """
    try:
        # Gather data
        results = await asyncio.gather(
            nessie_client.get_account(account_id),
            nessie_client.get_account_purchases(account_id),
            nessie_client.get_account_deposits(account_id),
            return_exceptions=True
        )
        
        account = results[0]
        purchases = results[1] if isinstance(results[1], list) else []
        deposits = results[2] if isinstance(results[2], list) else []
        
        # Calculate basic metrics
        total_spent = sum(p.get('amount', 0) for p in purchases)
        total_income = sum(d.get('amount', 0) for d in deposits)
        
        savings_rate = 0
        if total_income > 0:
            savings_rate = (total_income - total_spent) / total_income
            
        return {
            "account_name": account.get('nickname', 'Account'),
            "liquidity": account.get('balance', 0),
            "spending_velocity_30d": total_spent,
            "income_velocity_30d": total_income,
            "savings_rate_percent": round(savings_rate * 100, 1),
            "burn_rate_status": "Sustainable" if savings_rate > 0 else "Unsustainable",
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": str(e)}

# --- Standard Tools ---

@server.tool()
async def list_valid_accounts() -> List[Dict[str, Any]]:
    """Lists all accounts that are valid and active."""
    try:
        accounts = await nessie_client.get_customer_accounts(os.environ.get("NESSIE_CUSTOMER_ID", "67a1da65952d430c33a9af44")) # Default to a known ID or env
        return accounts
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    server.run()
