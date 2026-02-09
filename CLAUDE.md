# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pigeon** is a personal finance app built for Tartan Hacks 2026 at CMU. It combines a React Native (Expo) frontend with a Python FastAPI backend, featuring AI-powered financial advice, location-based spending alerts ("danger zones"), and bank integration via Plaid/Nessie APIs.

## Common Commands

### Starting the Backend
```bash
# Run Python backend directly (preferred for local dev)
PORT=5001 python3 server_py/main.py

# Alternative: TS proxy server that also serves Expo static builds
npm run server:dev
```
**Important**: Run from the project root so `.env` is loaded by `dotenv`. The Python backend defaults to port 5000 if `PORT` is not set — always pass `PORT=5001` or ensure `.env` is loaded.

### Starting the Frontend
```bash
npx expo start          # standard
npx expo start --tunnel # for mobile device testing
npx expo start --web    # web only
```

### Linting
```bash
npm run lint
npx expo lint --fix
```

### Python Dependencies
```bash
# This machine uses Homebrew python3 (3.14) — pip3 targets a different python.
# Always install with:
/opt/homebrew/bin/python3 -m pip install --user --break-system-packages <package>

# All required packages (from pyproject.toml):
# fastapi, httpx, plaid-python, sse-starlette, uvicorn, python-dotenv,
# openai, requests, pandas, numpy, scikit-learn, xgboost
```

### Database
SQLite database at `server_py/finance.db`. Schema is auto-created on module import of `server_py/database.py`. No migrations — tables are created with `CREATE TABLE IF NOT EXISTS`.

## Architecture

### Two-Layer Backend
There are **two servers** that work together:
1. **TypeScript Express server** (`server/index.ts`) — serves the Expo static build, landing page, and proxies API requests
2. **Python FastAPI server** (`server_py/main.py`) — the actual API backend with all business logic

In development, `npm run server:dev` runs the TS server which handles routing. The Python server runs on its own (typically started separately or via `run_server.sh`).

### Frontend Architecture
- **Expo Router** (file-based routing) in `app/` directory
- **Tab navigation**: Dashboard (`index.tsx`), Activity (`transactions.tsx`), Budget (`budget.tsx`), Advisor (`advisor.tsx`), Tools (`tools.tsx`), Pigeon (`pigeon-test.tsx`)
- **Modal screens**: `advisor-modal.tsx` (chat UI), `plaid-link.tsx`, `onboarding-survey.tsx`
- **Two React Contexts** wrap the entire app:
  - `FinanceProvider` (`lib/finance-context.tsx`) — accounts, transactions, budgets, predictions, survey state. This is the primary data store.
  - `PigeonProvider` (`lib/pigeon-context.tsx`) — geo-behavioral monitoring state, danger zone tracking
- **API client**: `lib/query-client.ts` exports `apiRequest()` and `getApiUrl()`. Base URL comes from `EXPO_PUBLIC_API_BASE_URL` env var (defaults to `http://172.25.4.240:5001`).
- Path aliases: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

### AI Chat System (`server_py/chat.py`)
The advisor uses a multi-agent "Boardroom" workflow:
- **QueryRouter** routes simple queries to different models (GPT-4o-mini default, GPT-4o for analysis, Gemini Flash for quantitative)
- **AgentOrchestrator** runs a 3-stage pipeline for complex queries: Screener (data ingestion) → Psychologist (behavioral profiling) → CFO (final advice)
- All LLM calls go through **Dedalus Labs API** (`DedalusClient`), which uses an OpenAI-compatible interface at `api.dedaluslabs.ai`
- Chat responses are streamed via SSE (`text/event-stream`)

### Purchase Predictor (`server_py/predictor_service.py`)
- XGBoost model with heuristic fallback if xgboost isn't installed
- Model files in `purchase_predictor/models/`
- Danger zones loaded from `purchase_predictor/data/danger_zones.json`
- Singleton `predictor_service` loaded at server startup

### Data Flow on App Start
1. Fonts load → splash screen hides
2. `FinanceProvider` mounts → checks survey status, fetches danger zones
3. If `EXPO_PUBLIC_DEMO_MODE=1`, calls `loadDemoData()` which tries Nessie API first, falls back to hardcoded `DEMO_ACCOUNTS`/`DEMO_TRANSACTIONS`
4. Dashboard redirects to `/onboarding-survey` if survey not completed
5. Survey answers sent to `/api/advisor/survey-analysis` → saved to SQLite `user_profile` table

### Demo Mode
Set `EXPO_PUBLIC_DEMO_MODE=1` to run without real API keys. The backend returns mock data for Plaid endpoints, and the frontend tries Nessie API then falls back to static demo data.

## Design System

- **Dark theme**: background `#0A0D14`, surface `#12161F`, lime green accent `#AAFF00`
- **Font**: DM Sans (400 Regular, 500 Medium, 600 SemiBold, 700 Bold)
- **Colors**: defined in `constants/colors.ts` — use `Colors.light.*` tokens
- **Component patterns**: cards use `surface` background + `border` + `borderRadius: 16-20`

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend URL (default: `http://172.25.4.240:5001`) |
| `EXPO_PUBLIC_DEMO_MODE` | Set to `1` for mock data |
| `EXPO_PUBLIC_DEDALUS_API_KEY` | Dedalus Labs API key for AI chat |
| `NESSIE_API_KEY` | Capital One Nessie mock banking API |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid sandbox credentials |
| `PORT` | Backend server port (default: 5001) |

## Important Patterns

- The `FinanceContext` is the central state store — almost all screens consume it via `useFinance()`
- Transactions with positive `amount` are spending; negative amounts are income/deposits
- "Regret Score" (0-100) is computed per transaction either by AI analysis or heuristic
- The Pigeon geofencing service (`lib/pigeon-service.ts`) uses foreground location polling (not background tasks) for Expo Go compatibility
- Budget spending is auto-calculated from transactions via `categorizeToBudget()` matching in `finance-context.tsx`

## Session Recovery

After closing laptop or restarting, only running processes are lost. Code, branch, `.env`, and installed dependencies persist. To resume:
1. `PORT=5001 python3 server_py/main.py` (backend)
2. `npx expo start` (frontend, in a separate terminal)

## Current State

- Working branch: `sam/changes` (pushed to remote, tracking `origin/sam/changes`)
- `.env` is configured with all API keys (Dedalus, Plaid sandbox, Nessie)
- Demo mode is enabled (`EXPO_PUBLIC_DEMO_MODE=1`)
- All npm and Python dependencies are installed
- The repo owner is `katsdivi` — Sam is a contributor working on a feature branch
