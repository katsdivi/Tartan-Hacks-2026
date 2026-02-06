# Origin Finance

## Overview

Origin Finance is a personal finance management mobile application built with Expo (React Native) and an Express.js backend. The app connects to users' bank accounts via Plaid, displays financial data (accounts, transactions, budgets, net worth), and includes an AI-powered financial advisor chat feature powered by OpenAI. The app uses a dark, neon-themed UI design and targets iOS, Android, and web platforms.

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
  - The Advisor tab immediately redirects to its modal
  - Error boundary component wraps the entire app
  - Keyboard handling via `react-native-keyboard-controller`

### Backend (Express.js)

- **Runtime**: Node.js with Express v5, written in TypeScript, compiled with `tsx` for dev and `esbuild` for production
- **API structure**: All routes registered in `server/routes.ts` via `registerRoutes()` function
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost for development
- **Key API endpoints**:
  - `POST /api/plaid/create-link-token` - Initialize Plaid Link
  - `POST /api/plaid/exchange-token` - Exchange Plaid public token for access token
  - `GET /api/plaid/accounts` - Fetch connected bank accounts
  - `GET /api/plaid/transactions` - Fetch transaction history
  - `POST /api/advisor/chat` - AI financial advisor streaming chat
- **Token storage**: Plaid access tokens are currently stored in-memory (server variable), not persisted to database

### Data Storage

- **Database**: PostgreSQL with Drizzle ORM
- **Schema location**: `shared/schema.ts` (main user schema) and `shared/models/chat.ts` (conversations and messages)
- **Schema push**: Use `npm run db:push` (drizzle-kit push) to sync schema to database
- **Current tables**:
  - `users` - id (UUID), username, password
  - `conversations` - id (serial), title, created_at
  - `messages` - id (serial), conversation_id (FK), role, content, created_at
- **In-memory storage**: `server/storage.ts` provides a `MemStorage` class for user CRUD that doesn't use the database. This is a placeholder that could be migrated to use Drizzle/Postgres
- **Client-side storage**: AsyncStorage for persisting connection state and demo mode flags

### Replit Integrations

Located in `server/replit_integrations/`, these are pre-built modules:
- **Chat**: Conversation CRUD with PostgreSQL storage, OpenAI streaming chat
- **Audio**: Voice recording, speech-to-text, text-to-speech, voice chat streaming
- **Image**: Image generation and editing via OpenAI's gpt-image-1 model
- **Batch**: Rate-limited batch processing utility with retry logic

### Build & Deployment

- **Development**: Two processes run simultaneously — Expo dev server (`expo:dev`) and Express server (`server:dev`)
- **Production build**: `expo:static:build` creates a static web bundle, `server:build` bundles the server with esbuild, `server:prod` serves the built app
- **The Express server proxies to the Expo dev server** during development using `http-proxy-middleware`
- **Landing page**: `server/templates/landing-page.html` served for non-API, non-static requests (likely a download/info page)

### API Communication Pattern

- Frontend uses `lib/query-client.ts` which constructs API URLs from `EXPO_PUBLIC_DOMAIN` environment variable
- All API calls go through `apiRequest()` helper that prepends the base URL and handles errors
- The AI advisor chat uses streaming fetch (`expo/fetch`) with SSE-style responses

## External Dependencies

### Third-Party Services

- **Plaid** (bank account connection): Uses Plaid Sandbox environment. Requires `PLAID_CLIENT_ID` and `PLAID_SECRET` environment variables. SDK: `plaid` npm package v41
- **OpenAI** (AI advisor & integrations): Uses Replit's AI Integrations proxy. Requires `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables. SDK: `openai` npm package v6
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable. Driver: `pg` package. ORM: Drizzle

### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `PLAID_CLIENT_ID` - Plaid API client ID
- `PLAID_SECRET` - Plaid API secret key
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit integrations)
- `REPLIT_DEV_DOMAIN` - Auto-set by Replit for development
- `EXPO_PUBLIC_DOMAIN` - Set in dev script, used by frontend to reach API

### Key NPM Dependencies

- `expo` ~54.0.27 - Mobile app framework
- `expo-router` ~6.0.17 - File-based routing
- `express` ^5.0.1 - Backend server
- `drizzle-orm` ^0.39.3 + `drizzle-kit` - Database ORM and migrations
- `plaid` ^41.1.0 - Banking API client
- `openai` ^6.18.0 - AI API client
- `@tanstack/react-query` ^5.83.0 - Server state management
- `react-native-reanimated`, `react-native-gesture-handler` - Animation and gestures
- `react-native-webview` - Used for Plaid Link integration