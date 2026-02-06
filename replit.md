# Origin Finance

## Overview

Origin Finance is a personal finance management mobile application built with Expo (React Native) and a Python/FastAPI backend. The app connects to users' bank accounts via Plaid, displays financial data (accounts, transactions, budgets, net worth), and includes an AI-powered financial advisor chat feature powered by OpenAI. The app uses a dark, neon-themed UI design and targets iOS, Android, and web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Routing**: expo-router v6 with file-based routing. Tab navigation lives in `app/(tabs)/` with four tabs: Dashboard (index), Activity (transactions), Budget, and Advisor
- **State Management**: React Context (`lib/finance-context.tsx`) for financial data (accounts, transactions, budgets, net worth). React Query (`@tanstack/react-query`) for server state and API calls
- **Styling**: Plain React Native `StyleSheet` with a centralized color theme in `constants/colors.ts`. The design uses a dark background with neon accent colors (cyan, pink, green, purple, yellow)
- **Fonts**: DM Sans (400, 500, 600, 700) loaded via `@expo-google-fonts/dm-sans`
- **Key UI patterns**:
  - Modals for Plaid bank connection (`app/plaid-link.tsx`) and AI advisor chat (`app/advisor-modal.tsx`)
  - Plaid Link runs inside a WebView
  - The Advisor tab shows a static landing screen with "Start Chat" button to prevent infinite modal loop
  - Error boundary component wraps the entire app
  - Keyboard handling via `react-native-keyboard-controller`
  - Budget modals use KeyboardAvoidingView to keep inputs visible above keyboard on mobile

### Backend (Python / FastAPI)

- **Runtime**: Python 3.11 with FastAPI and Uvicorn
- **Entry point**: `server_py/main.py` — all routes, middleware, and static file serving in one file
- **Launcher**: `server/index.ts` spawns the Python process (so the existing `npm run server:dev` workflow works unchanged)
- **CORS**: Custom middleware with dynamic origin allowlist based on Replit environment variables, plus localhost for development
- **Key API endpoints**:
  - `POST /api/plaid/create-link-token` - Initialize Plaid Link
  - `POST /api/plaid/exchange-token` - Exchange Plaid public token for access token
  - `GET /api/plaid/accounts` - Fetch connected bank accounts
  - `GET /api/plaid/transactions` - Fetch transaction history (last 7 days)
  - `GET /api/plaid/balance` - Get account balances
  - `GET /api/plaid/status` - Check if bank account is connected
  - `POST /api/plaid/disconnect` - Disconnect bank account
  - `POST /api/advisor/chat` - AI financial advisor streaming chat (SSE)
- **Token storage**: Plaid access tokens are currently stored in-memory (server variable), not persisted to database
- **Landing page**: `server/templates/landing-page.html` served at `/` with dynamic URL placeholder replacement
- **Static files**: `/assets` and `/static-build` directories served for Expo builds

### Data Storage

- **Database**: PostgreSQL with Drizzle ORM (used by Node.js integration modules)
- **Schema location**: `shared/schema.ts` (main user schema) and `shared/models/chat.ts` (conversations and messages)
- **Schema push**: Use `npm run db:push` (drizzle-kit push) to sync schema to database
- **Current tables**:
  - `users` - id (UUID), username, password
  - `conversations` - id (serial), title, created_at
  - `messages` - id (serial), conversation_id (FK), role, content, created_at
- **Client-side storage**: AsyncStorage for persisting connection state and demo mode flags

### Replit Integrations

Located in `server/replit_integrations/`, these are pre-built Node.js modules (legacy, not actively used by Python backend):
- **Chat**: Conversation CRUD with PostgreSQL storage, OpenAI streaming chat
- **Audio**: Voice recording, speech-to-text, text-to-speech, voice chat streaming
- **Image**: Image generation and editing via OpenAI's gpt-image-1 model
- **Batch**: Rate-limited batch processing utility with retry logic

### Build & Deployment

- **Development**: Two processes run simultaneously — Expo dev server (`expo:dev`) and Python FastAPI server (via `server:dev` which launches `server_py/main.py`)
- **Production build**: `expo:static:build` creates a static web bundle; production server setup needs updating for Python
- **Landing page**: `server/templates/landing-page.html` served for root requests

### API Communication Pattern

- Frontend uses `lib/query-client.ts` which constructs API URLs from `EXPO_PUBLIC_DOMAIN` environment variable
- All API calls go through `apiRequest()` helper that prepends the base URL and handles errors
- The AI advisor chat uses streaming fetch (`expo/fetch`) with SSE-style responses

## External Dependencies

### Third-Party Services

- **Plaid** (bank account connection): Uses Plaid Sandbox environment. Requires `PLAID_CLIENT_ID` and `PLAID_SECRET` environment variables. Python SDK: `plaid-python` v38
- **OpenAI** (AI advisor): Uses Replit's AI Integrations proxy. Requires `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables. Python SDK: `openai` v2
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable

### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `PLAID_CLIENT_ID` - Plaid API client ID
- `PLAID_SECRET` - Plaid API secret key
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit integrations)
- `REPLIT_DEV_DOMAIN` - Auto-set by Replit for development
- `EXPO_PUBLIC_DOMAIN` - Set in dev script, used by frontend to reach API

### Key Python Dependencies (Backend)

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `plaid-python` - Plaid banking API client
- `openai` - OpenAI API client (async)
- `httpx` - HTTP client
- `sse-starlette` - Server-Sent Events support

### Key NPM Dependencies (Frontend)

- `expo` ~54.0.27 - Mobile app framework
- `expo-router` ~6.0.17 - File-based routing
- `@tanstack/react-query` ^5.83.0 - Server state management
- `react-native-reanimated`, `react-native-gesture-handler` - Animation and gestures
- `react-native-webview` - Used for Plaid Link integration

## Recent Changes

- **2026-02-06**: Migrated entire backend from Node.js/Express to Python/FastAPI. All API endpoints (Plaid, AI advisor chat with SSE streaming) now served by `server_py/main.py`. The `server/index.ts` acts as a thin launcher that spawns the Python process.
- **2026-02-06**: Added KeyboardAvoidingView to budget edit/add modals for mobile keyboard support
- **2026-02-06**: Implemented demo data fallback system with sample accounts, transactions, and budgets
