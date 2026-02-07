import SwiftUI
import UserNotifications
import Combine

// GLOBAL STATE to control the popup
class AppState: ObservableObject {
    @Published var showFeedbackSheet = false
    @Published var lastAlertPlace = "Unknown"
}

// DELEGATE to handle clicks
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    // We need access to the AppState
    var appState: AppState?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    
    // 1. Show notification even if app is open
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
    
    // 2. Handle CLICK event
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        print("👆 User clicked notification!")
        
        // Extract the place name from the notification title if possible
        let title = response.notification.request.content.title
        // e.g. "⚠️ High Regret Risk: The Dive Bar" -> "The Dive Bar"
        let place = title.components(separatedBy: ": ").last ?? "Current Location"
        
        // Trigger the UI on the main thread
        DispatchQueue.main.async {
            self.appState?.lastAlertPlace = place
            self.appState?.showFeedbackSheet = true
        }
        
        completionHandler()
    }
}

@main
struct pigeonApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject var locationManager = LocationManager()
    @StateObject var appState = AppState() // Create the global state
    
    init() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState) // Pass state to views
                .onAppear {
                    appDelegate.appState = appState // Link delegate to state
                    locationManager.startMonitoring()
                }
                // THE POPUP TRIGGER
                .sheet(isPresented: $appState.showFeedbackSheet) {
                    FeedbackView(
                        isPresented: $appState.showFeedbackSheet,
                        placeName: appState.lastAlertPlace
                    )
                }
        }
    }
}
