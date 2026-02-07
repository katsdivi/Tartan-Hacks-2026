import os
import httpx
import asyncio
from typing import Any, Dict, List, Optional

NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "https://api.reimaginebanking.com")
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY", "")

class NessieClient:
    def __init__(self, base_url: str = NESSIE_BASE_URL, api_key: str = NESSIE_API_KEY):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if params is None:
            params = {}

        # Strategy A: key in query
        params_with_key = dict(params)
        if self.api_key:
            params_with_key["key"] = self.api_key

        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params_with_key)
            r.raise_for_status()
            return r.json()

    async def get_customers(self) -> List[Dict[str, Any]]:
        return await self._get("/customers")

    async def get_customer_accounts(self, customer_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/customers/{customer_id}/accounts")

    async def get_account(self, account_id: str) -> Dict[str, Any]:
        return await self._get(f"/accounts/{account_id}")

    async def get_account_customer(self, account_id: str) -> Dict[str, Any]:
        return await self._get(f"/accounts/{account_id}/customer")

    async def get_account_bills(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/bills")

    async def get_account_deposits(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/deposits")

    async def get_account_loans(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/loans")

    async def get_account_purchases(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/purchases")

    async def get_account_transfers(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/transfers")

    async def get_account_withdrawals(self, account_id: str) -> List[Dict[str, Any]]:
        return await self._get(f"/accounts/{account_id}/withdrawals")
