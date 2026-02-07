import Foundation

class PersonalizationStore {
    static let shared = PersonalizationStore()
    private let defaults = UserDefaults.standard
    
    // SAVE: Update the regret score for a specific merchant
    // feedbackScore: 1.0 (Helpful), 0.5 (Somewhat), 0.0 (Not Helpful)
    func updateRegret(for place: String, feedbackScore: Double) {
        // 1. Get current score (Default to 0.8 if new)
        let currentScore = getRegret(for: place)
        
        // 2. Calculate new score (Weighted Average)
        // We give the new feedback 20% weight (Learning Rate = 0.2)
        // If feedback is 1.0 (Helpful) -> Score goes UP
        // If feedback is 0.0 (Not Helpful) -> Score goes DOWN
        let newScore = (currentScore * 0.8) + (feedbackScore * 0.2)
        
        // 3. Save it
        defaults.set(newScore, forKey: "regret_\(place)")
        print("🧠 LEARNING: \(place) regret adjusted from \(currentScore.formatted()) to \(newScore.formatted())")
    }
    
    // READ: Get the personalized score
    func getRegret(for place: String) -> Double {
        // If we have a saved score, use it.
        // If not, return a default "High Risk" baseline (0.75)
        if defaults.object(forKey: "regret_\(place)") != nil {
            return defaults.double(forKey: "regret_\(place)")
        }
        return 0.75
    }
}

// Helper to print nice numbers
extension Double {
    func formatted() -> String {
        return String(format: "%.2f", self)
    }
}//
//  PersonalizationStore.swift
//  pigeon
//
//  Created by Abhinav Kumar on 2/7/26.
//

