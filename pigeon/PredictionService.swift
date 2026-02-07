//import Foundation
import CoreML

class PredictionService {
    // Load the model
    let model: PurchasePredictor? = {
        do {
            let config = MLModelConfiguration()
            return try PurchasePredictor(configuration: config)
        } catch {
            print("❌ Failed to load model: \(error)")
            return nil
        }
    }()

    func predictRisk(
        distance: Double,
        budgetUsed: Double,
        regretRate: Double,
        dwellTime: Double
    ) -> Bool {
        
        guard let model = model else { return false }

        // Automatically calculate time context
        let date = Date()
        let calendar = Calendar.current
        let hour = Double(calendar.component(.hour, from: date))
        let isWeekend = calendar.isDateInWeekend(date) ? 1.0 : 0.0

        do {
            // Inputs must match the model's expected names EXACTLY
            let input = PurchasePredictorInput(
                distance_to_merchant: distance,
                hour_of_day: hour,
                is_weekend: isWeekend,
                budget_utilization: budgetUsed,
                merchant_regret_rate: regretRate,
                dwell_time: dwellTime
            )

            // Run Prediction
            let output = try model.prediction(input: input)
            
            // Get probability of "1" (Purchase/Risk)
            // 'classProbability' is the output name shown in your screenshot
            let riskScore = output.classProbability[1] ?? 0.0
            
            print("🔮 Risk Calculation: \(Int(riskScore * 100))%")
            
            // Trigger alert if risk is > 70%
            return riskScore > 0.7

        } catch {
            print("Prediction Error: \(error)")
            return false
        }
    }
}
//  PredictionService.swift
//  pigeon
//
//  Created by Abhinav Kumar on 2/7/26.
//

