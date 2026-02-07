import Foundation
import CoreLocation

// This represents one "Cluster" your Python script found
struct DangerZone: Identifiable, Codable {
    var id: String             // e.g., "The Dive Bar"
    var lat: Double            // e.g., 40.444
    var lng: Double            // e.g., -79.943
    var radius: Double         // e.g., 50.0 meters
    var riskLevel: String      // "High", "Medium", "Low"
    
    // Helper to get a proper coordinate object
    var coordinate: CLLocationCoordinate2D {
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
