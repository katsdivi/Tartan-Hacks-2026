import SwiftUI
import Combine
import CoreLocation
import UserNotifications

class LocationManager: NSObject, CLLocationManagerDelegate, ObservableObject {
    let manager = CLLocationManager()
    let predictor = PredictionService()
    
    // DEMO DATA: We assume the user is "Broke" (95% budget used)
    let currentBudgetUtilization = 0.95
    
    override init() {
        super.init()
        manager.delegate = self
        manager.requestAlwaysAuthorization()
    }
    
    func startMonitoring() {
        // 1. Load the Personalized Zones (The ones Python found)
        let zones = loadDangerZones()
        
        // 2. Clear any old geofences to be safe
        for region in manager.monitoredRegions {
            manager.stopMonitoring(for: region)
        }
        
        // 3. Create a Geofence for EVERY Danger Zone
        print("🗺️ Loading Personalization...")
        for zone in zones {
            let region = CLCircularRegion(
                center: zone.coordinate,
                radius: zone.radius,
                identifier: zone.id
            )
            region.notifyOnEntry = true
            region.notifyOnExit = false
            
            manager.startMonitoring(for: region)
            print("   📍 Monitoring Habit Cluster: \(zone.id)")
        }
        print("✅ System Armed: \(zones.count) zones active.")
    }
    
    // --- THIS IS THE BRIDGE TO YOUR PYTHON SCRIPT ---
    func loadDangerZones() -> [DangerZone] {
        // In a real app, this would download 'danger_zones.json'
        // For the demo, we paste the Python output here:
        return [
            DangerZone(
                id: "The Dive Bar",
                lat: 40.444,     // <--- Coordinates from your Python Script
                lng: -79.943,
                radius: 50,
                riskLevel: "High"
            ),
            // You can add a second one to prove it handles multiple!
            DangerZone(
                id: "Tech Store",
                lat: 40.430,
                lng: -79.950,
                radius: 50,
                riskLevel: "Medium"
            )
        ]
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        print("🚨 Entered Habit Zone: \(region.identifier)")
        
        // Dynamic Logic:
        // If it's the "Bar", we know regret is high.
        // If it's the "Tech Store", maybe it's medium.
        let personalizedRegret = PersonalizationStore.shared.getRegret(for: region.identifier)
            
        print("   📊 Using Personalized Regret Score: \(Int(personalizedRegret * 100))%")
        
        let shouldAlert = predictor.predictRisk(
                distance: 10.0,
                budgetUsed: currentBudgetUtilization,
                regretRate: personalizedRegret, // <--- PASSED HERE
                dwellTime: 0.0
            )
            
            if shouldAlert {
                sendNotification(placeName: region.identifier)
            }
    }
    
    func sendNotification(placeName: String) {
        let content = UNMutableNotificationContent()
        // We use ": " as a separator to extract the name later
        content.title = "⚠️ High Regret Risk: \(placeName)"
        content.body = "Our AI detected a spending habit here. Tap to give feedback."
        content.sound = .default
        
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
