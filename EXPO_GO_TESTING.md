# Testing Pigeon with Expo Go

## ✅ What's Ready

I've created an **Expo Go-compatible** version of Pigeon that you can test right now!

**Changes Made**:
1. ✅ Modified [`pigeon-service.ts`](file:///Users/divyamkataria/Financial-Advisor-AI/lib/pigeon-service.ts) to use **foreground location polling** (checks every 30 seconds)
2. ✅ Created test screen: [`app/(tabs)/pigeon-test.tsx`](file:///Users/divyamkataria/Financial-Advisor-AI/app/%28tabs%29/pigeon-test.tsx)
3. ✅ Added "Pigeon 🧪" tab to navigation

---

## 📱 How to Test (Step by Step)

### 1. Start Your Backend

```bash
npm run server:dev
```

Make sure it's running on your local network (not just localhost).

### 2. Update API URL (if needed)

If testing on a physical phone, update your `.env`:

```bash
# Replace with your computer's local IP
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:5001
```

To find your IP:
- **Mac**: System Preferences → Network → Advanced → TCP/IP
- **Windows**: `ipconfig` in Command Prompt

### 3. Start Expo

```bash
npx expo start
```

Scan the QR code with Expo Go app on your phone.

### 4. Open the Pigeon Test Tab

In the app, tap the **"Pigeon 🧪"** tab at the bottom.

### 5. Grant Permissions

When prompted:
- **Location**: Tap "Allow While Using App"
- **Notifications**: Tap "Allow"

### 6. Test Options

#### Option A: Manual Check (Easiest)

1. Tap **"Check Current Location Now"**
2. This will:
   - Get your current coordinates
   - Send them to the backend
   - Run ML prediction
   - Show alert if high risk

#### Option B: Automatic Monitoring

1. Tap **"Start Monitoring"**
2. The app will check your location every 30 seconds while open
3. You'll get notifications if you're near a danger zone
4. ⚠️ **Keep the app open** (backgrounding stops it due to Expo Go limits)

---

## 🗺️ Simulating Location

Since you probably aren't near the demo danger zones, you'll need to fake your location:

### iOS (Easier Method)

Use a location spoofing app from the App Store:
1. Download "Location Spoofer" or similar
2. Set location to: **40.444, -79.943** (The Dive Bar)
3. Go back to your app and tap "Check Current Location Now"

### Android

1. Enable Developer Options:
   - Settings → About Phone → Tap Build Number 7 times
2. Settings → System → Developer Options
3. Select Mock Location App → "Expo Go"
4. Use a fake GPS app to set location to: **40.444, -79.943**

---

## 🎯 Expected Behavior

When you check a location near a danger zone (within 50m):

1. **API Call**: App sends location + budget utilization to `/api/pigeon/check-location`
2. **Backend Processes**:
   - Checks if location is in a danger zone ✓
   - Checks quiet hours ✓
   - Runs XGBoost prediction ✓
   - Generates AI notification message ✓
3. **You See**:
   - Alert popup with spending warning
   - Shows regret score (e.g., 78/100)
   - Shows risk level (low/medium/high)

---

## 📊 What You'll See in the Test Screen

### Your Location
- Current coordinates
- Refresh button

### Monitoring Status
- Green (Active) or Red (Inactive)
- Start/Stop button

### Manual Check Button
- Instant location check
- Shows results in a box below

### Danger Zones List
- All configured zones from backend
- Distance from each zone
- ⚠️ indicator when within 50m

---

## 🧪 Sample Test Flow

1. **Backend running?** Check: `curl http://localhost:5001/api/pigeon/danger-zones`
2. **Open app** → Go to "Pigeon 🧪" tab
3. **Check your location** → Should show coordinates
4. **See danger zones** → Should show 2 demo zones
5. **Tap "Check Current Location Now"**
   - If far away: "✅ All Clear" with low regret score
   - If near danger zone: "⚠️ Spending Alert" with high score
6. **Try with fake location** at 40.444, -79.943
   - Should trigger high-risk alert

---

## ⚠️ Limitations (Expo Go)

| Feature | Works in Expo Go? |
|---|---|
| Manual location check | ✅ Yes |
| Foreground monitoring (app open) | ✅ Yes |
| Background geofencing (app closed) | ❌ No (needs dev build) |
| Notifications when app open | ✅ Yes |
| Notifications when app closed | ❌ No (needs dev build) |

---

## 🔧 Troubleshooting

### "Failed to fetch danger zones"
- Check backend is running: `npm run server:dev`
- Check API URL in `.env` matches your network IP
- Try: `curl http://YOUR_IP:5001/api/pigeon/danger-zones`

### Location not updating
- Make sure you granted location permission
- Tap "Refresh Location" button
- Check phone settings → Privacy → Location Services

### No notification appearing
- Notifications only work when app is **open** in Expo Go
- Check if `should_notify` is `true` in the result box
- Try increasing budget utilization (mock it as 0.95 in the service)

### Distance always shows 0m
- Your fake GPS might not be working
- Try a different location spoofing app
- Or manually edit coordinates in the test screen code

---

## 🚀 Next Steps

Once you verify it's working:
1. Create real danger zones from your transaction data
2. Build a proper settings UI
3. Consider building a development build for true background geofencing

---

## 📝 Quick Commands

```bash
# Start backend
npm run server:dev

# Start Expo
npx expo start

# Check danger zones
curl http://localhost:5001/api/pigeon/danger-zones

# Manual location test
curl -X POST http://localhost:5001/api/pigeon/check-location \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.444, "lng": -79.943, "budgetUtilization": 0.95}'
```
