# 💰 Origin Finance

A premium personal finance management app built with React Native (Expo) and Python FastAPI. Features AI-powered financial advice, location-based spending alerts, and seamless bank integration.

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-green)
![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-purple)
![Python](https://img.shields.io/badge/Python-3.11+-yellow)

---

## ✨ Features

### 📊 Dashboard
- Real-time net worth tracking
- Account balances overview
- Spending predictions with ML
- Financial health insights

### 💳 Transaction Tracking
- Automatic transaction categorization
- "Regret Score" analysis for purchases
- Income vs. spending visualization

### 📈 Budget Management
- Category-based budgets with circular progress visualization
- Real-time spending alerts
- Monthly budget tracking

### 🤖 AI Financial Advisor
- Personalized financial advice via chat
- Spending behavior analysis
- Goal-based recommendations
- Powered by Dedalus Labs LLM

### 🐦 Pigeon (Location-Based Alerts)
- Geo-behavioral risk detection
- "Danger Zone" identification near high-regret spending locations
- Smart nudges when approaching risky areas
- Background location monitoring

### 🛠️ Smart Tools
- Purchase simulator
- Subscription monitor
- Danger zone alerts
- Tactical spending widgets

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Expo/React Native)              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │Dashboard│ │ Budget  │ │Advisor  │ │ Pigeon  │ │ Tools  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
│       └───────────┴───────────┴───────────┴──────────┘      │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────┼───────────────────────────────┐
│                    BACKEND (Python FastAPI)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Plaid   │ │  Nessie  │ │   Chat   │ │ Pigeon Predictor │ │
│  │   API    │ │   API    │ │  Service │ │     Service      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│                      │                                       │
│                ┌─────┴─────┐                                 │
│                │  SQLite   │                                 │
│                │  Database │                                 │
│                └───────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.11+
- **Expo Go** app on your mobile device (for testing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Tartan-Hacks-2026
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip3 install -r server_py/requirements.txt
   # Or using uv:
   # uv pip install -r pyproject.toml
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys (see API Keys section below)
   ```

5. **Start the backend server**
   ```bash
   npm run server:dev
   ```

6. **Start the Expo frontend** (in a new terminal)
   ```bash
   npx expo start --tunnel
   ```

7. **Scan the QR code** with Expo Go (iOS/Android) or press `w` for web

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Database (PostgreSQL - only needed for production)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/local-db

# Plaid API (Sandbox credentials)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret

# Dedalus Labs AI (For AI advisor chat)
EXPO_PUBLIC_DEDALUS_API_KEY=your_dedalus_api_key

# Capital One Nessie API (Mock banking data)
NESSIE_API_KEY=your_nessie_api_key
NESSIE_BASE_URL=https://api.reimaginebanking.com

# Expo / Frontend
EXPO_PUBLIC_API_BASE_URL=http://localhost:5001
EXPO_PUBLIC_DOMAIN=localhost:5001
EXPO_PUBLIC_DEMO_MODE=1

# Server Port
PORT=5001
```

---

## 🔑 API Keys

### Demo Mode (No API keys required)
Set `EXPO_PUBLIC_DEMO_MODE=1` to use mock data without any external APIs.

### Plaid API
1. Create account at [Plaid Dashboard](https://dashboard.plaid.com)
2. Get Sandbox credentials from the Keys section
3. Add `PLAID_CLIENT_ID` and `PLAID_SECRET` to `.env`

### Dedalus Labs (AI Advisor)
1. Sign up at [Dedalus Labs](https://dedaluslabs.com)
2. Generate an API key
3. Add `EXPO_PUBLIC_DEDALUS_API_KEY` to `.env`

### Capital One Nessie (Optional)
1. Register at [Nessie API Hackathon](http://api.reimaginebanking.com)
2. Create an API key
3. Add `NESSIE_API_KEY` to `.env`

---

## 📱 Running the App

### Development

```bash
# Terminal 1: Start backend
npm run server:dev

# Terminal 2: Start Expo with tunnel (for mobile testing)
npx expo start --tunnel
```

### Platform-specific

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Web browser
npx expo start --web
```

---

## 🗂️ Project Structure

```
├── app/                  # Expo Router screens
│   ├── (tabs)/          # Tab navigation screens
│   │   ├── index.tsx    # Dashboard
│   │   ├── budget.tsx   # Budget management
│   │   ├── advisor.tsx  # AI Financial Advisor
│   │   ├── pigeon-test.tsx # Location alerts
│   │   ├── tools.tsx    # Smart tools
│   │   └── transactions.tsx
│   ├── _layout.tsx      # Root layout
│   ├── onboarding-survey.tsx
│   └── advisor-modal.tsx
├── components/          # Reusable UI components
├── constants/           # App constants (colors, etc.)
├── lib/                 # Utilities and context providers
│   ├── finance-context.tsx
│   └── pigeon-context.tsx
├── server_py/           # Python backend
│   ├── main.py         # FastAPI application
│   ├── chat.py         # AI chat service
│   ├── database.py     # SQLite database
│   └── predictor_service.py
├── pigeon/             # Pigeon ML pipeline
└── purchase_predictor/ # Purchase prediction models
```

---

## 🧪 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plaid/create-link-token` | POST | Create Plaid Link token |
| `/api/plaid/exchange-token` | POST | Exchange public token |
| `/api/plaid/accounts` | GET | Get connected accounts |
| `/api/plaid/transactions` | GET | Get transactions |
| `/api/plaid/status` | GET | Check connection status |
| `/api/advisor/chat` | POST | AI chat (streaming) |
| `/api/advisor/survey-analysis` | POST | Analyze onboarding survey |
| `/api/pigeon/danger-zones` | GET | Get danger zones |
| `/api/pigeon/check-location` | POST | Check location risk |
| `/api/pigeon/risk-score` | GET | Get risk score for coordinates |

---

## 🎨 Design System

The app uses a **premium dark theme** with a **lime green accent** (`#AAFF00`):

| Token | Color | Usage |
|-------|-------|-------|
| `background` | `#0A0D14` | Main background |
| `surface` | `#12161F` | Cards, containers |
| `tint` | `#AAFF00` | Primary accent |
| `positive` | `#4ADE80` | Success states |
| `negative` | `#FF6B6B` | Error/warning states |

---

## 🛠️ Scripts

```bash
npm run server:dev    # Start Python backend (development)
npm run start         # Start Expo
npm run lint          # Run ESLint
npm run db:push       # Push Drizzle schema changes
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project was built for **Tartan Hacks 2026** at Carnegie Mellon University.

---

## 🙏 Acknowledgments

- [Plaid](https://plaid.com) - Banking API
- [Capital One Nessie](http://api.reimaginebanking.com) - Mock banking data
- [Dedalus Labs](https://dedaluslabs.com) - AI/LLM infrastructure
- [Expo](https://expo.dev) - React Native framework
