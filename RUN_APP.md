# Running Pigeon on iOS Simulator

**Project path:** `/Users/samruch/Documents/Tartan-Hacks-2026`

## Connecting to the branch

If you already have the repo cloned:
```bash
cd /Users/samruch/Documents/Tartan-Hacks-2026
git checkout sam/changes
git pull
```

If cloning fresh on another machine:
```bash
git clone https://github.com/katsdivi/Tartan-Hacks-2026.git
cd Tartan-Hacks-2026
git checkout sam/changes
```

## Prerequisites
- All npm and Python dependencies installed
- `.env` configured with API keys
- Xcode installed with iPhone 16e simulator

## Steps

### 1. Start the backend
```bash
PORT=5001 python3 server_py/main.py
```
Wait for: `Uvicorn running on http://0.0.0.0:5001`

### 2. Verify backend is running
```bash
curl http://localhost:5001/health
```
Should return: `{"ok":true}`

### 3. Start Expo and launch simulator
In a **separate terminal**:
```bash
npx expo start --ios
```
This boots the iPhone 16e simulator, installs Expo Go, and opens the app.

## What to expect
- App loads the Dashboard
- If Nessie API is unavailable, it falls back to static demo data (this is fine)
- On first launch, you'll be redirected to the onboarding survey (11 questions)
- `expo-notifications` warnings in the console are normal for Expo Go

## Shutting down
1. Close the Simulator app (or `xcrun simctl shutdown "iPhone 16e"`)
2. `Ctrl+C` in the Expo terminal
3. `Ctrl+C` in the backend terminal
