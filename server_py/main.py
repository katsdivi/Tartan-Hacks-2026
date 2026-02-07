import os
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
import dotenv; dotenv.load_dotenv() # Add this line

import random
from datetime import date, timedelta





from nessie_client import NessieClient
from chat import ChatService
from fastapi import FastAPI, Request, Response


from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from fastapi.staticfiles import StaticFiles

from fastapi.middleware.cors import CORSMiddleware

from starlette.middleware.base import BaseHTTPMiddleware



import plaid

from plaid.api import plaid_api

from plaid.model.link_token_create_request import LinkTokenCreateRequest

from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser

from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

from plaid.model.accounts_get_request import AccountsGetRequest

from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest

from plaid.model.transactions_get_request import TransactionsGetRequest

from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions

from plaid.model.products import Products

from plaid.model.country_code import CountryCode

import requests # Added for debugging


app = FastAPI()

# --- DEMO MODE CONFIGURATION ---
DEMO_MODE = os.environ.get("EXPO_PUBLIC_DEMO_MODE", "0") == "1"

demo_accounts_data = [
    {
        "account_id": "demo_checking",
        "name": "Plaid Checking",
        "official_name": "Plaid Checking Account",
        "type": "depository",
        "subtype": "checking",
        "mask": "0000",
        "balances": {
            "available": 1200.00,
            "current": 1250.00,
            "limit": None,
            "iso_currency_code": "USD",
        },
    },
    {
        "account_id": "demo_credit",
        "name": "Plaid Credit Card",
        "official_name": "Plaid Visa Card",
        "type": "credit",
        "subtype": "credit card",
        "mask": "1111",
        "balances": {
            "available": 5000.00,
            "current": 2500.00,
            "limit": 7500.00,
            "iso_currency_code": "USD",
        },
    },
]

def generate_demo_transactions():
    transactions = []
    today = date.today()

    categories = [
        ["Food and Drink", "Restaurants"],
        ["Food and Drink", "Groceries"],
        ["Travel", "Airlines and Aviation Services"],
        ["Transfer", "Credit Card Payment"],
        ["Payment", "Payroll"],
        ["Shops", "Electronics"],
        ["Service", "Utilities"],
    ]
    merchants = [
        "Starbucks", "Whole Foods", "Delta Airlines", "Rent Payment",
        "Apple Store", "Electric Company", "Netflix", "Uber Eats"
    ]
    amounts = [5.50, 15.20, 250.00, 1200.00, 3000.00, 799.99, 50.00, 22.50]
    payment_channels = ["in store", "online", "other"]

    for i in range(30):
        transaction_date = today - timedelta(days=i)
        for _ in range(random.randint(0, 2)): # 0 to 2 transactions per day
            category = random.choice(categories)
            merchant = random.choice(merchants)
            amount = round(random.choice(amounts) * random.uniform(0.8, 1.2), 2)
            payment_channel = random.choice(payment_channels)
            account_id = random.choice(["demo_checking", "demo_credit"])

            transactions.append({
                "transaction_id": f"demo_txn_{len(transactions)}",
                "account_id": account_id,
                "name": merchant,
                "amount": amount if account_id == "demo_checking" else -amount, # Simulate credit card spend
                "date": str(transaction_date),
                "category": category,
                "pending": False,
                "merchant_name": merchant,
                "payment_channel": payment_channel,
                "iso_currency_code": "USD",
            })
    # Add a couple of "regrettable" and "anomaly" transactions
    transactions.append({
        "transaction_id": "demo_txn_regret_1", "account_id": "demo_checking",
        "name": "McDonald's", "amount": 8.75, "date": str(today - timedelta(days=2)),
        "category": ["Food and Drink", "Fast Food"], "pending": False, "merchant_name": "McDonald's",
        "payment_channel": "in store", "iso_currency_code": "USD",
        "regretScore": 75, "regretReason": "Unhealthy late night snack"
    })
    transactions.append({
        "transaction_id": "demo_txn_anomaly_1", "account_id": "demo_checking",
        "name": "Big Apple Purchase", "amount": 1500.00, "date": str(today - timedelta(days=5)),
        "category": ["Shops", "Electronics"], "pending": False, "merchant_name": "Apple",
        "payment_channel": "online", "iso_currency_code": "USD",
        "regretScore": 90, "regretReason": "Expensive impulse purchase"
    })
    transactions.append({
        "transaction_id": "demo_txn_paycheck", "account_id": "demo_checking",
        "name": "Payroll Deposit", "amount": -3500.00, "date": str(today - timedelta(days=7)),
        "category": ["Transfer", "Deposit"], "pending": False, "merchant_name": "Employer",
        "payment_channel": "other", "iso_currency_code": "USD",
    })


    return transactions

demo_transactions_data = generate_demo_transactions()

# --- END DEMO MODE CONFIGURATION ---

PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID", "")

PLAID_SECRET = os.environ.get("PLAID_SECRET", "")





configuration = plaid.Configuration(

    host=plaid.Environment.Sandbox,

    api_key={

        "clientId": PLAID_CLIENT_ID,

        "secret": PLAID_SECRET,

    },

)

api_client = plaid.ApiClient(configuration)

plaid_client = plaid_api.PlaidApi(api_client)




stored_access_token: str | None = None
stored_item_id: str | None = None


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

landing_page_path = Path(__file__).parent.parent / "server" / "templates" / "landing-page.html"
landing_page_template = landing_page_path.read_text() if landing_page_path.exists() else "<h1>Origin Finance</h1>"


def get_app_name() -> str:
    try:
        app_json_path = Path(__file__).parent.parent / "app.json"
        data = json.loads(app_json_path.read_text())
        return data.get("expo", {}).get("name", "App Landing Page")
    except Exception:
        return "App Landing Page"


@app.get("/")
async def root(request: Request):
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost"))
    base_url = f"{forwarded_proto}://{forwarded_host}"
    exps_url = forwarded_host

    platform = request.headers.get("expo-platform")
    if platform and platform in ("ios", "android"):
        manifest_path = Path(__file__).parent.parent / "static-build" / platform / "manifest.json"
        if not manifest_path.exists():
            return JSONResponse({"error": f"Manifest not found for platform: {platform}"}, status_code=404)
        manifest = manifest_path.read_text()
        return Response(
            content=manifest,
            media_type="application/json",
            headers={
                "expo-protocol-version": "1",
                "expo-sfv-version": "0",
            },
        )

    app_name = get_app_name()
    html = (
        landing_page_template
        .replace("BASE_URL_PLACEHOLDER", base_url)
        .replace("EXPS_URL_PLACEHOLDER", exps_url)
        .replace("APP_NAME_PLACEHOLDER", app_name)
    )
    return HTMLResponse(html)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/plaid/create-link-token")
async def create_link_token():
    if DEMO_MODE:
        return {"link_token": "demo-link-token"}
    
    print(f"Plaid Configuration: {configuration}")
    try:
        # Test basic requests connectivity
        try:
            print("Attempting requests.get to sandbox.plaid.com...")
            requests_response = requests.get("https://sandbox.plaid.com")
            print(f"requests.get to sandbox.plaid.com successful. Status: {requests_response.status_code}")
        except Exception as req_e:
            print(f"requests.get to sandbox.plaid.com failed: {req_e}")
            
        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(client_user_id="user-1"),
            client_name="Origin Finance",
            products=[Products("transactions"), Products("auth")],
            country_codes=[CountryCode("US")],
            language="en",
        )
        response = plaid_client.link_token_create(request)
        return {"link_token": response.link_token}
    except plaid.ApiException as e:
        error_body = json.loads(e.body) if e.body else {}
        print(f"Create link token error: {error_body}")
        return JSONResponse({"error": "Failed to create link token"}, status_code=500)
    except Exception as e:
        print(f"Create link token error: {e}")
        return JSONResponse({"error": "Failed to create link token"}, status_code=500)


@app.post("/api/plaid/exchange-token")
async def exchange_token(request: Request):
    global stored_access_token, stored_item_id
    if DEMO_MODE:
        stored_access_token = "demo-access-token"
        stored_item_id = "demo-item-id"
        return {"success": True}

    try:
        body = await request.json()
        public_token = body.get("public_token")
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = plaid_client.item_public_token_exchange(exchange_request)
        stored_access_token = response.access_token
        stored_item_id = response.item_id
        return {"success": True}
    except plaid.ApiException as e:
        error_body = json.loads(e.body) if e.body else {}
        print(f"Exchange token error: {error_body}")
        return JSONResponse({"error": "Failed to exchange token"}, status_code=500)
    except Exception as e:
        print(f"Exchange token error: {e}")
        return JSONResponse({"error": "Failed to exchange token"}, status_code=500)


@app.get("/api/plaid/accounts")
async def get_accounts():
    if DEMO_MODE:
        return {"accounts": demo_accounts_data}
    
    try:
        if not stored_access_token:
            return JSONResponse({"error": "No bank account connected"}, status_code=400)
        accounts_request = AccountsGetRequest(access_token=stored_access_token)
        response = plaid_client.accounts_get(accounts_request)
        accounts = []
        for acc in response.accounts:
            accounts.append({
                "account_id": acc.account_id,
                "name": acc.name,
                "official_name": acc.official_name,
                "type": str(acc.type),
                "subtype": str(acc.subtype) if acc.subtype else None,
                "mask": acc.mask,
                "balances": {
                    "available": acc.balances.available,
                    "current": acc.balances.current,
                    "limit": acc.balances.limit,
                    "iso_currency_code": acc.balances.iso_currency_code,
                },
            })
        return {"accounts": accounts}
    except plaid.ApiException as e:
        error_body = json.loads(e.body) if e.body else {}
        print(f"Get accounts error: {error_body}")
        return JSONResponse({"error": "Failed to get accounts"}, status_code=500)
    except Exception as e:
        print(f"Get accounts error: {e}")
        return JSONResponse({"error": "Failed to get accounts"}, status_code=500)


@app.get("/api/plaid/transactions")
async def get_transactions():
    if DEMO_MODE:
        return {
            "transactions": demo_transactions_data,
            "total": len(demo_transactions_data),
        }
    
    try:
        if not stored_access_token:
            return JSONResponse({"error": "No bank account connected"}, status_code=400)

        now = datetime.now()
        seven_days_ago = now - timedelta(days=7)
        start_date = seven_days_ago.date()
        end_date = now.date()

        txn_request = TransactionsGetRequest(
            access_token=stored_access_token,
            start_date=start_date,
            end_date=end_date,
            options=TransactionsGetRequestOptions(count=100, offset=0),
        )
        response = plaid_client.transactions_get(txn_request)
        transactions = []
        
        # Collect IDs to fetch existing scores
        txn_ids = [txn.transaction_id for txn in response.transactions]
        existing_metadata = database.get_transaction_metadata(txn_ids)
        
        user_profile = database.get_user_profile()
        
        # Background task for analysis (conceptually - simplistic async execution here)
        # In a real production app, use BackgroundTasks or Celery
        
        # Helper to process transaction if metadata missing
        async def process_missing_metadata(txn_obj, txn_dict):
            if txn_dict["transaction_id"] not in existing_metadata:
                # Analyze and save
                analysis = await chat_service.analyze_transaction_regret(txn_dict, user_profile)
                database.save_transaction_regret(
                    txn_dict["transaction_id"], 
                    analysis.get("score", 0), 
                    analysis.get("reason", "")
                )
                # Update the in-memory dictionary to return it immediately if possible
                # (Though usually we'd return what we have and let UI update on next fetch,
                # here we'll try to await it if it's fast enough, or just trigger it)

        # We will process analysis in parallel for this batch to ensure user gets data
        # Note: This might slow down the response time for the list. 
        # Optimization: Only analyze top 5 recent ones, or queue the rest.
        # For this demo, we'll try to do it for the current page content.

        temp_transactions = []

        for txn in response.transactions:
            t_dict = {
                "transaction_id": txn.transaction_id,
                "account_id": txn.account_id,
                "name": txn.name,
                "amount": txn.amount,
                "date": str(txn.date),
                "category": list(txn.category) if txn.category else [],
                "pending": txn.pending,
                "merchant_name": txn.merchant_name,
                "payment_channel": str(txn.payment_channel),
                "iso_currency_code": txn.iso_currency_code,
            }
            temp_transactions.append(t_dict)

        # Identify missing analysis
        missing_analysis_txns = [t for t in temp_transactions if t["transaction_id"] not in existing_metadata]
        
        if missing_analysis_txns and user_profile:
            # We limit to analyzing 5 concurrently to avoid timeout constraints for this MVP
            to_analyze = missing_analysis_txns[:5] 
            
            async def analyze_and_save(t):
                 analysis = await chat_service.analyze_transaction_regret(t, user_profile)
                 database.save_transaction_regret(t["transaction_id"], analysis["score"], analysis["reason"])
                 return t["transaction_id"], analysis

            results = await asyncio.gather(*(analyze_and_save(t) for t in to_analyze))
            
            # Update metadata dict
            for tid, result in results:
                existing_metadata[tid] = {"regret_score": result["score"], "regret_reason": result["reason"]}

        # Build final response
        for t in temp_transactions:
            meta = existing_metadata.get(t["transaction_id"], {})
            t["regretScore"] = meta.get("regret_score", None)
            t["regretReason"] = meta.get("regret_reason", None)
            transactions.append(t)

        return {
            "transactions": transactions,
            "total": response.total_transactions,
        }
    except plaid.ApiException as e:
        error_body = json.loads(e.body) if e.body else {}
        print(f"Get transactions error: {error_body}")
        return JSONResponse({"error": "Failed to get transactions"}, status_code=500)
    except Exception as e:
        print(f"Get transactions error: {e}")
        return JSONResponse({"error": "Failed to get transactions"}, status_code=500)


@app.get("/api/plaid/balance")
async def get_balance():
    if DEMO_MODE:
        return {"accounts": demo_accounts_data} # Same as get_accounts for simplicity
    
    try:
        if not stored_access_token:
            return JSONResponse({"error": "No bank account connected"}, status_code=400)
        balance_request = AccountsBalanceGetRequest(access_token=stored_access_token)
        response = plaid_client.accounts_balance_get(balance_request)
        accounts = []
        for acc in response.accounts:
            accounts.append({
                "account_id": acc.account_id,
                "name": acc.name,
                "official_name": acc.official_name,
                "type": str(acc.type),
                "subtype": str(acc.subtype) if acc.subtype else None,
                "mask": acc.mask,
                "balances": {
                    "available": acc.balances.available,
                    "current": acc.balances.current,
                    "limit": acc.balances.limit,
                    "iso_currency_code": acc.balances.iso_currency_code,
                },
            })
        return {"accounts": accounts}
    except plaid.ApiException as e:
        error_body = json.loads(e.body) if e.body else {}
        print(f"Get balance error: {error_body}")
        return JSONResponse({"error": "Failed to get balance"}, status_code=500)
    except Exception as e:
        print(f"Get balance error: {e}")
        return JSONResponse({"error": "Failed to get balance"}, status_code=500)


@app.get("/api/plaid/status")
async def plaid_status():
    if DEMO_MODE:
        return {"connected": True} # Always connected in demo mode
    return {"connected": stored_access_token is not None}


@app.post("/api/plaid/disconnect")
async def plaid_disconnect():
    global stored_access_token, stored_item_id
    if DEMO_MODE:
        stored_access_token = None
        stored_item_id = None
        return {"success": True}

    stored_access_token = None
    stored_item_id = None
    return {"success": True}




static_build_path = Path(__file__).parent.parent / "static-build"
if static_build_path.exists():
    app.mount("/static-build", StaticFiles(directory=str(static_build_path)), name="static-build")

assets_path = Path(__file__).parent.parent / "assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")


# --- CAPITIAL ONE NESSIE INTEGRATION ---

nessie_client = NessieClient()

@app.get("/api/capitalone/customers")
async def get_customers():
    try:
        customers = await nessie_client.get_customers()
        return {"customers": customers}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)

@app.get("/api/capitalone/customer/{customer_id}/snapshot")
async def customer_snapshot(customer_id: str):
    try:
        # 1. Get all accounts for the customer
        accounts = await nessie_client.get_customer_accounts(customer_id)

        # 2. Hydrate each account with details in parallel
        async def hydrate_account(a):
            aid = a.get("_id") or a.get("id") or a.get("account_id")
            if not aid:
                return {"raw": a, "error": "missing_account_id"}

            # Gather all related data for this account
            account, customer, bills, deposits, loans, purchases, transfers, withdrawals = await asyncio.gather(
                nessie_client.get_account(aid),
                nessie_client.get_account_customer(aid),
                nessie_client.get_account_bills(aid),
                nessie_client.get_account_deposits(aid),
                nessie_client.get_account_loans(aid),
                nessie_client.get_account_purchases(aid),
                nessie_client.get_account_transfers(aid),
                nessie_client.get_account_withdrawals(aid),
                return_exceptions=True # Continue even if some sub-requests fail
            )

            # Helper to handle exceptions in gather results
            def clean_result(res):
                return res if not isinstance(res, Exception) else {"error": str(res)}

            return {
                "account": clean_result(account),
                "customer": clean_result(customer),
                "bills": clean_result(bills),
                "deposits": clean_result(deposits),
                "loans": clean_result(loans),
                "purchases": clean_result(purchases),
                "transfers": clean_result(transfers),
                "withdrawals": clean_result(withdrawals),
            }

        hydrated_accounts = await asyncio.gather(*(hydrate_account(a) for a in accounts))

        return {"customer_id": customer_id, "accounts": hydrated_accounts}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": f"Nessie error: {str(e)}"}, status_code=502)

# --- END CAPITAL ONE NESSIE INTEGRATION ---

# --- CHAT INTEGRATION ---
chat_service = ChatService()

@app.post("/api/advisor/chat")
async def advisor_chat(request: Request):
    try:
        body = await request.json()
        messages = body.get("messages", [])
        financial_context = body.get("financialContext", "")
        survey_context = body.get("surveyContext", "")
        
        async def event_generator():
            try:
                # Pass survey_context to the stream method
                async for chunk in chat_service.get_response_stream(messages, financial_context, survey_context):
                    yield f"data: {json.dumps({'choices': [{'delta': {'content': chunk}}]})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                print(f"Stream error: {e}")
                error_msg = json.dumps({"error": str(e)})
                yield f"data: {error_msg}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except Exception as e:
        print(f"Chat endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
# --- END CHAT INTEGRATION ---

import database # Import local database module
from predictor_service import predictor_service
from datetime import datetime # Added for Pigeon quiet hours

@app.post("/api/advisor/survey-analysis")
async def survey_analysis(request: Request):
    try:
        body = await request.json()
        answers = body.get("answers", {})
        financial_context = body.get("financialContext", "")
        
        analysis = await chat_service.analyze_survey(answers, financial_context)
        
        # Save analysis to DB for future personality context
        if analysis:
            database.save_user_profile(
                analysis.get("spending_regret", ""),
                analysis.get("user_goals", ""),
                analysis.get("top_categories", [])
            )
            
        return analysis
    except Exception as e:
        print(f"Survey analysis error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/advisor/insights")
async def advisor_insights(request: Request):
    try:
        body = await request.json()
        transactions = body.get("transactions", [])
        
        # Get profile from DB (or could pass from frontend, but DB is safer/persistent)
        user_profile = database.get_user_profile()
        
        summary = await chat_service.generate_behavioral_summary(transactions, user_profile)
        return {"behavioral_summary": summary}
    except Exception as e:
        print(f"Insights error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# --- PIGEON GEO-BEHAVIORAL RISK DETECTION ---

@app.get("/api/pigeon/danger-zones")
async def get_danger_zones():
    """Get all danger zones with regret data from ML pipeline"""
    try:
        predictor_service.load()
        zones = predictor_service.get_danger_zones()
        return {"danger_zones": zones, "count": len(zones)}
    except Exception as e:
        print(f"Danger zones error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/pigeon/check-location")
async def check_location(request: Request):
    """
    Check if user's location is in a danger zone and predict regret risk.
    
    Body: {
        "lat": float,
        "lng": float,
        "budgetUtilization": float (0.0-1.0),
        "merchantCategory": str (optional)
    }
    """
    try:
        body = await request.json()
        lat = body.get("lat")
        lng = body.get("lng")
        budget_util = body.get("budgetUtilization", 0.5)
        merchant_category = body.get("merchantCategory", "Unknown")
        
        if lat is None or lng is None:
            return JSONResponse({"error": "lat and lng required"}, status_code=400)
        
        # Get user settings
        settings = database.get_pigeon_user_settings()
        
        # Check if monitoring is enabled
        if not settings["monitoring_enabled"]:
            return {"monitoring_enabled": False, "should_notify": False}
        
        # Check quiet hours
        now = datetime.now()
        current_hour = now.hour
        quiet_start = settings["quiet_hours_start"]
        quiet_end = settings["quiet_hours_end"]
        
        in_quiet_hours = False
        if quiet_start > quiet_end:  # Wraps midnight
            in_quiet_hours = current_hour >= quiet_start or current_hour < quiet_end
        else:
            in_quiet_hours = quiet_start <= current_hour < quiet_end
        
        # Get merchant regret rate from DB (based on category)
        user_profile = database.get_user_profile()
        merchant_regret_rate = 0.5  # Default
        
        if user_profile and merchant_category:
            # Check if this category is in user's high-regret categories
            top_categories = user_profile.get("top_categories", [])
            if merchant_category in top_categories:
                merchant_regret_rate = 0.75  # Higher regret for known problem categories
        
        # Run prediction
        prediction = predictor_service.predict_for_transaction(
            distance_meters=10.0,  # Assume user is at the location
            budget_utilization=budget_util,
            merchant_regret_rate=merchant_regret_rate,
            dwell_time_seconds=0,
            lat=lat,
            lng=lng
        )
        
        # Determine if we should notify
        should_notify = (
            prediction["should_nudge"]
            and prediction["in_danger_zone"]
            and not in_quiet_hours
            and budget_util >= 0.6  # Only notify if budget is somewhat depleted
        )
        
        # Calculate regret score (1-100)
        regret_score = int(prediction["probability"] * 100)
        
        result = {
            "monitoring_enabled": True,
            "in_danger_zone": prediction["in_danger_zone"],
            "danger_zone": prediction.get("danger_zone"),
            "predicted_probability": prediction["probability"],
            "regret_score": regret_score,
            "risk_level": prediction["risk_level"],
            "should_notify": should_notify,
            "in_quiet_hours": in_quiet_hours,
            "model_type": prediction["model_type"]
        }
        
        # If should notify, generate notification message
        if should_notify:
            zone_name = prediction.get("danger_zone", {}).get("merchant_name", "this location")
            notification_message = await generate_notification_message(
                zone_name, merchant_category, regret_score, budget_util, current_hour
            )
            result["notification_message"] = notification_message
            
            # Log intervention
            intervention_id = database.save_pigeon_intervention(
                danger_zone_id=prediction.get("danger_zone", {}).get("merchant_name", "unknown"),
                latitude=lat,
                longitude=lng,
                predicted_probability=prediction["probability"],
                predicted_score=regret_score,
                risk_level=prediction["risk_level"],
                merchant_category=merchant_category,
                budget_utilization=budget_util,
                hour_of_day=current_hour,
                notification_sent=True,
                notification_message=notification_message
            )
            result["intervention_id"] = intervention_id
        
        return result
        
    except Exception as e:
        print(f"Check location error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


async def generate_notification_message(
    zone_name: str,
    category: str,
    regret_score: int,
    budget_util: float,
    hour: int
) -> str:
    """Generate contextual notification message using AI"""
    try:
        # Build context for AI
        user_profile = database.get_user_profile()
        goals = user_profile.get("user_goals", "") if user_profile else ""
        
        prompt = f"""Generate a brief, actionable notification message (max 2 sentences) for a spending intervention alert.

Context:
- Location: {zone_name}
- Category: {category}
- Predicted regret score: {regret_score}/100
- Budget utilization: {int(budget_util * 100)}%
- Time: {hour}:00 (24-hour)
- User goals: {goals}

The message should:
1. State the behavioral signal detected
2. Relate to their budget or goals
3. Be encouraging, not judgmental

Example: "You're near {zone_name} at {hour}:00. Late-night {category} purchases typically have a {regret_score}% regret rate, and you've used {int(budget_util * 100)}% of your budget."

Generate only the notification message, nothing else."""

        messages = [{"role": "user", "content": prompt}]
        response = await chat_service.dedalus_client.chat_completion(
            "openai/gpt-4o-mini", messages, stream=False
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Notification generation error: {e}")
        # Fallback message
        return f"⚠️ High regret risk near {zone_name}. Predicted regret: {regret_score}/100. You've used {int(budget_util * 100)}% of your budget."


@app.post("/api/pigeon/log-intervention")
async def log_intervention(request: Request):
    """Log a Pigeon intervention (for manual logging from frontend)"""
    try:
        body = await request.json()
        intervention_id = database.save_pigeon_intervention(**body)
        return {"intervention_id": intervention_id, "success": True}
    except Exception as e:
        print(f"Log intervention error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/pigeon/intervention-feedback")
async def intervention_feedback(request: Request):
    """Update intervention with user feedback"""
    try:
        body = await request.json()
        intervention_id = body.get("intervention_id")
        user_response = body.get("user_response")  # helpful/not_helpful/ignored
        
        if not intervention_id or not user_response:
            return JSONResponse({"error": "intervention_id and user_response required"}, status_code=400)
        
        database.update_pigeon_intervention_response(intervention_id, user_response)
        return {"success": True}
    except Exception as e:
        print(f"Intervention feedback error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/pigeon/settings")
async def get_pigeon_settings():
    """Get user's Pigeon settings"""
    try:
        settings = database.get_pigeon_user_settings()
        return settings
    except Exception as e:
        print(f"Get settings error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/pigeon/settings")
async def update_pigeon_settings(request: Request):
    """Update user's Pigeon settings"""
    try:
        body = await request.json()
        database.update_pigeon_user_settings(**body)
        return {"success": True, "settings": database.get_pigeon_user_settings()}
    except Exception as e:
        print(f"Update settings error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# --- END PIGEON INTEGRATION ---


# --- PURCHASE PREDICTOR INTEGRATION ---
# The predictor_service import was moved up to be with other imports
# from predictor_service import predictor_service # This line is now redundant here

@app.on_event("startup")
async def load_predictor():
    """Pre-load the purchase prediction model at server startup."""
    predictor_service.load()


@app.get("/api/predictor/danger-zones")
async def get_danger_zones():
    """Return all identified danger zones with geofence coordinates."""
    try:
        zones = predictor_service.get_danger_zones()
        return {"danger_zones": zones, "count": len(zones)}
    except Exception as e:
        print(f"Danger zones error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/predictor/predict")
async def predict_purchase(request: Request):
    """
    Predict purchase probability given contextual features.

    Body:
    {
        "distance_to_merchant": 30,       // meters
        "hour_of_day": 23,                // optional, auto-detected if missing
        "is_weekend": 1,                  // optional, auto-detected if missing
        "budget_utilization": 0.85,       // 0.0-1.0
        "merchant_regret_rate": 0.7,      // 0.0-1.0
        "dwell_time": 120,               // seconds
        "lat": 40.444,                    // optional, for danger zone check
        "lng": -79.943                    // optional, for danger zone check
    }
    """
    try:
        body = await request.json()

        lat = body.pop("lat", None)
        lng = body.pop("lng", None)

        result = predictor_service.predict_for_transaction(
            distance_meters=body.get("distance_to_merchant", 100),
            budget_utilization=body.get("budget_utilization", 0.5),
            merchant_regret_rate=body.get("merchant_regret_rate", 0.0),
            dwell_time_seconds=body.get("dwell_time", 0),
            lat=lat,
            lng=lng,
        )
        return result
    except Exception as e:
        print(f"Prediction error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/predictor/check-location")
async def check_location(request: Request):
    """
    Check if the user's current location is in a danger zone.

    Body: { "lat": 40.444, "lng": -79.943 }
    """
    try:
        body = await request.json()
        lat = body.get("lat")
        lng = body.get("lng")

        if lat is None or lng is None:
            return JSONResponse({"error": "lat and lng are required"}, status_code=400)

        zone = predictor_service.check_danger_zone(lat, lng)
        return {
            "in_danger_zone": zone is not None,
            "danger_zone": zone,
        }
    except Exception as e:
        print(f"Location check error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/predictor/batch-predict")
async def batch_predict(request: Request):
    """
    Run predictions on multiple transactions for analytics.

    Body: { "transactions": [ { ...features... }, ... ] }
    """
    try:
        body = await request.json()
        transactions = body.get("transactions", [])

        results = []
        for txn in transactions[:50]:  # Limit to 50 per batch
            features = {
                "distance_to_merchant": txn.get("distance_to_merchant", 100),
                "hour_of_day": txn.get("hour_of_day", 12),
                "is_weekend": txn.get("is_weekend", 0),
                "budget_utilization": txn.get("budget_utilization", 0.5),
                "merchant_regret_rate": txn.get("merchant_regret_rate", 0.0),
                "dwell_time": txn.get("dwell_time", 0),
            }
            prediction = predictor_service.predict(features)
            prediction["transaction_id"] = txn.get("transaction_id", None)
            results.append(prediction)

        return {"predictions": results, "count": len(results)}
    except Exception as e:
        print(f"Batch prediction error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# --- END PURCHASE PREDICTOR INTEGRATION ---


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)