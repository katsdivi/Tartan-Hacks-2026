import SwiftUI

struct FeedbackView: View {
    @Binding var isPresented: Bool
    var placeName: String
    
    var body: some View {
        VStack(spacing: 25) {
            Text("Was this alert helpful?")
                .font(.title2)
                .bold()
                .padding(.top, 40)
            
            Text("Your feedback trains your personalized AI.")
                .font(.subheadline)
                .foregroundColor(.gray)
            
            // OPTION 1: POSITIVE (Label = 1.0)
            Button(action: { submitFeedback(score: 1.0) }) {
                FeedbackButton(icon: "star.fill", text: "Very Helpful", color: .green)
            }
            
            // OPTION 2: NEUTRAL (Label = 0.5)
            Button(action: { submitFeedback(score: 0.5) }) {
                FeedbackButton(icon: "hand.thumbsup.fill", text: "Somewhat", color: .yellow)
            }
            
            // OPTION 3: NEGATIVE (Label = 0.0)
            Button(action: { submitFeedback(score: 0.0) }) {
                FeedbackButton(icon: "xmark.octagon.fill", text: "Not Helpful", color: .red)
            }
            
            Spacer()
        }
        .padding()
        .presentationDetents([.height(450)]) // Makes it a nice half-sheet
    }
    
    func submitFeedback(score: Double) {
        // 1. INSTANTLY UPDATE LOCAL BRAIN
        PersonalizationStore.shared.updateRegret(for: placeName, feedbackScore: score)
        
        // 2. (Optional) Send to Server for Global Training
        // ... your existing network code ...
        print("✅ Feedback processed locally & queued for server.")
        
        // 3. Close the sheet
        isPresented = false
    }
}

// Helper View for consistent buttons
struct FeedbackButton: View {
    let icon: String
    let text: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
            Text(text)
        }
        .font(.headline)
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding()
        .background(color)
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}
