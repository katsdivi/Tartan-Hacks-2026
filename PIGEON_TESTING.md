# Development Build Setup for Pigeon Testing

## ✅ What I've Done

1. ✅ Installed EAS CLI globally (`eas-cli`)
2. ✅ Created [`eas.json`](file:///Users/divyamkataria/Financial-Advisor-AI/eas.json) configuration
3. ✅ Updated [`app.json`](file:///Users/divyamkataria/Financial-Advisor-AI/app.json) with:
   - Background location permissions (iOS & Android)
   - Notification permissions
   - Location plugin configuration

---

## 📱 Next Steps: Build & Install

### Step 1: Login to Expo

```bash
npx eas login
```

> If you don't have an Expo account, create one at https://expo.dev

### Step 2: Configure Your Project

```bash
npx eas build:configure
```

This will link your project to your Expo account.

### Step 3: Choose Your Platform & Build

**For iOS (iPhone):**

```bash
npx eas build --profile development --platform ios
```

**For Android:**

```bash
npx eas build --profile development --platform android
```

**For Both:**

```bash
npx eas build --profile development --platform all
```

> **Note**: The build process happens on Expo's servers and typically takes 10-20 minutes. You'll get a URL to track progress.

### Step 4: Install on Your Device

#### iOS Installation

After the build completes:
1. You'll get a QR code and download link
2. Open the link on your iPhone
3. Tap "Install" (you may need to trust the developer certificate in Settings → General → VPN & Device Management)

#### Android Installation

After the build completes:
1. Download the `.apk` file to your Android device
2. Enable "Install from Unknown Sources" in Settings
3. Tap the downloaded file to install

### Step 5: Start the Dev Server

While the build is running, or after installation:

```bash
npx expo start --dev-client
```

This starts the Metro bundler. Your development build will connect to this server.

---

## 🧪 Testing Pigeon Geofencing

### 1. Grant Permissions

When you first open the app:
- **Location**: Choose "Allow While Using App" → then "Change to Always Allow" in Settings
- **Notifications**: Tap "Allow"

### 2. Enable Pigeon Monitoring

You'll need to create a settings screen, but for now you can enable it via the backend:

```bash
# Enable monitoring
curl -X POST http://YOUR_BACKEND_URL/api/pigeon/settings \
  -H "Content-Type: application/json" \
  -d '{"monitoring_enabled": true}'
```

Replace `YOUR_BACKEND_URL` with:
- If testing locally: Your computer's local IP (e.g., `http://192.168.1.100:5001`)
- If deployed: Your production URL

### 3. Simulate Location (iOS)

1. Connect your iPhone to your Mac
2. Open Xcode → Window → Devices and Simulators
3. Select your device → ... → Simulate Location
4. Choose a custom GPX location or type coordinates

### 4. Simulate Location (Android)

1. Enable Developer Options
2. Settings → System → Developer Options → Select mock location app → Your app
3. Use an app like "Fake GPS Location" to set coordinates

### 5. Test with Real Danger Zones

Your backend currently has demo danger zones at:
- **"The Dive Bar"**: 40.444, -79.943
- **"Tech Store"**: 40.430, -79.950

Set your simulated location to within 50m of these coordinates to trigger a geofence.

### 6. Verify Notification

When you enter a danger zone:
1. Backend predicts regret risk
2. If risk is high → you'll get a local notification
3. Check logs: `npx expo start --dev-client` terminal will show "🚨 Entered danger zone: ..."

---

## 🔧 Troubleshooting

### Build Fails

- **iOS**: Make sure you have "Paid Apple Developer Account" ($99/year) for distribution
  - For local testing only, use: `--profile development` with `"simulator": true` in eas.json
  - This builds for iOS Simulator (no device needed)
  
- **Android**: Should work without any account fees

### Geofencing Not Triggering

1. Check permissions: Settings → Your App → Location → "Always"
2. Check monitoring status: Call `GET /api/pigeon/settings` → `monitoring_enabled` should be `true`
3. Check danger zones: Call `GET /api/pigeon/danger-zones` → should return zones
4. Check logs in Metro bundler terminal

### Background Location Permission Denied (iOS)

iOS requires a 2-step permission flow:
1. First: "Allow While Using App"
2. Then: User must manually go to Settings → App → Location → "Always"

You may need to prompt users to do this manually.

---

## 🎯 Quick Command Reference

```bash
# Login
npx eas login

# Build for iOS
npx eas build --profile development --platform ios

# Build for Android
npx eas build --profile development --platform android

# Check build status
npx eas build:list

# Start dev server
npx expo start --dev-client

# View backend logs
npm run server:dev
```

---

## 📝 Expected Behavior

Once everything is set up:

1. **App opens** → Requests location + notification permissions
2. **User enables Pigeon** → Geofences registered for danger zones
3. **User approaches merchant** (within 50m) → Geofence triggers
4. **Backend checks**:
   - Budget utilization
   - Time of day (quiet hours)
   - ML predicts regret score
5. **If high risk** → Notification appears with contextual message
6. **User taps notification** → Opens AI advisor modal (when implemented)

---

## 🚀 Production Build (Later)

When ready to deploy:

```bash
# iOS (requires Apple Developer account)
npx eas build --profile production --platform ios
npx eas submit --platform ios

# Android
npx eas build --profile production --platform android
npx eas submit --platform android
```

This will publish to App Store / Google Play.
