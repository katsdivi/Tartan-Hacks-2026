import os
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
import dotenv; dotenv.load_dotenv() # Add this line

import google.generativeai as genai



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



PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID", "")

PLAID_SECRET = os.environ.get("PLAID_SECRET", "")

genai.configure(api_key=os.environ["GEMINI_API_KEY"])



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


class CORSMiddlewareCustom(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")

        is_localhost = origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")

        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)

        if is_localhost:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Allow-Credentials"] = "true"

        return response


app.add_middleware(CORSMiddlewareCustom)

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
        for txn in response.transactions:
            transactions.append({
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
            })
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
    return {"connected": stored_access_token is not None}


@app.post("/api/plaid/disconnect")
async def plaid_disconnect():
    global stored_access_token, stored_item_id
    stored_access_token = None
    stored_item_id = None
    return {"success": True}


@app.post("/api/advisor/chat")
async def advisor_chat(request: Request):
    try:
        body = await request.json()
        messages = body.get("messages", [])
        financial_context = body.get("financialContext", "")

        if financial_context:
            context_section = f"""Here is the user's current financial data:
{financial_context}

Use this data to provide specific, personalized advice."""
        else:
            context_section = "The user hasn't connected their bank account yet. Encourage them to connect it for personalized advice, but still provide general financial guidance."

        system_prompt = f"""You are Origin, a professional AI financial advisor. You provide personalized, actionable financial guidance.

{context_section}

Guidelines:
- Be concise but thorough
- Give specific, actionable recommendations
- Use numbers and percentages when relevant
- Be encouraging but realistic
- Format responses with clear structure
- Never provide specific investment advice or stock picks
- Focus on budgeting, saving, debt management, and financial planning"""

        model = genai.GenerativeModel('gemini-flash')

        async def generate():
            try:
                # The Gemini API uses a different message format than OpenAI,
                # so we need to convert the messages.
                gemini_messages = []
                for message in messages:
                    role = 'user' if message['role'] == 'user' else 'model'
                    gemini_messages.append({'role': role, 'parts': [message['content']]})
                
                # Add the system prompt as the first message
                gemini_messages.insert(0, {'role': 'user', 'parts': [system_prompt]})


                stream = await model.generate_content(
                    gemini_messages,
                    stream=True,
                )
                async for chunk in stream:
                    content = chunk.text if hasattr(chunk, 'text') and chunk.text else ""
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                print(f"Streaming error: {e}")
                yield f"data: {json.dumps({'error': 'Failed to get response'})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        print(f"AI advisor error: {e}")
        return JSONResponse({"error": "Failed to get AI response"}, status_code=500)


static_build_path = Path(__file__).parent.parent / "static-build"
if static_build_path.exists():
    app.mount("/static-build", StaticFiles(directory=str(static_build_path)), name="static-build")

assets_path = Path(__file__).parent.parent / "assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)