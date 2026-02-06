import { apiRequest } from "@/lib/query-client";

export async function createLinkToken(): Promise<string> {
  const res = await apiRequest("POST", "/api/plaid/create-link-token");
  const data = await res.json();
  return data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  await apiRequest("POST", "/api/plaid/exchange-token", { public_token: publicToken });
}
