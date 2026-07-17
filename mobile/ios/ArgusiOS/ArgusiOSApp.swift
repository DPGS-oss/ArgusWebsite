import SwiftUI

@main
struct ArgusiOSApp: App {
    @StateObject private var appVM = AppViewModel()

    var body: some Scene {
        WindowGroup {
            DashboardView()
                .environmentObject(appVM)
        }
    }
}
