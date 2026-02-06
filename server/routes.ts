import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import OpenAI from "openai";

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

let storedAccessToken: string | null = null;
let storedItemId: string | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/plaid/create-link-token", async (req: Request, res: Response) => {
    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: "user-1" },
        client_name: "Origin Finance",
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: "en",
      });
      res.json({ link_token: response.data.link_token });
    } catch (error: any) {
      console.error("Create link token error:", error?.response?.data || error);
      res.status(500).json({ error: "Failed to create link token" });
    }
  });

  app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
    try {
      const { public_token } = req.body;
      const response = await plaidClient.itemPublicTokenExchange({
        public_token,
      });
      storedAccessToken = response.data.access_token;
      storedItemId = response.data.item_id;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Exchange token error:", error?.response?.data || error);
      res.status(500).json({ error: "Failed to exchange token" });
    }
  });

  app.get("/api/plaid/accounts", async (req: Request, res: Response) => {
    try {
      if (!storedAccessToken) {
        return res.status(400).json({ error: "No bank account connected" });
      }
      const response = await plaidClient.accountsGet({
        access_token: storedAccessToken,
      });
      res.json({ accounts: response.data.accounts });
    } catch (error: any) {
      console.error("Get accounts error:", error?.response?.data || error);
      res.status(500).json({ error: "Failed to get accounts" });
    }
  });

  app.get("/api/plaid/transactions", async (req: Request, res: Response) => {
    try {
      if (!storedAccessToken) {
        return res.status(400).json({ error: "No bank account connected" });
      }
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const startDate = sevenDaysAgo.toISOString().split("T")[0];
      const endDate = now.toISOString().split("T")[0];

      const response = await plaidClient.transactionsGet({
        access_token: storedAccessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: 100, offset: 0 },
      });
      res.json({
        transactions: response.data.transactions,
        total: response.data.total_transactions,
      });
    } catch (error: any) {
      console.error("Get transactions error:", error?.response?.data || error);
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.get("/api/plaid/balance", async (req: Request, res: Response) => {
    try {
      if (!storedAccessToken) {
        return res.status(400).json({ error: "No bank account connected" });
      }
      const response = await plaidClient.accountsBalanceGet({
        access_token: storedAccessToken,
      });
      res.json({ accounts: response.data.accounts });
    } catch (error: any) {
      console.error("Get balance error:", error?.response?.data || error);
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  app.get("/api/plaid/status", async (_req: Request, res: Response) => {
    res.json({ connected: !!storedAccessToken });
  });

  app.post("/api/plaid/disconnect", async (_req: Request, res: Response) => {
    storedAccessToken = null;
    storedItemId = null;
    res.json({ success: true });
  });

  app.post("/api/advisor/chat", async (req: Request, res: Response) => {
    try {
      const { messages, financialContext } = req.body;

      const systemPrompt = `You are Origin, a professional AI financial advisor. You provide personalized, actionable financial guidance.

${financialContext ? `Here is the user's current financial data:
${financialContext}

Use this data to provide specific, personalized advice.` : "The user hasn't connected their bank account yet. Encourage them to connect it for personalized advice, but still provide general financial guidance."}

Guidelines:
- Be concise but thorough
- Give specific, actionable recommendations
- Use numbers and percentages when relevant
- Be encouraging but realistic
- Format responses with clear structure
- Never provide specific investment advice or stock picks
- Focus on budgeting, saving, debt management, and financial planning`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_completion_tokens: 2048,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("AI advisor error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to get AI response" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
