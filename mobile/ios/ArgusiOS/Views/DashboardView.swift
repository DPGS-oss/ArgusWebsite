import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var appVM: AppViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let business = appVM.appData.businesses.first(where: { $0.id == appVM.appData.activeBusinessId }) {
                        Text(business.name)
                            .font(.title2)
                            .fontWeight(.bold)

                        HStack {
                            StatCard(title: "Invoices", value: "\(appVM.appData.invoices.count)")
                            StatCard(title: "Parties", value: "\(appVM.appData.parties.count)")
                        }

                        HStack {
                            StatCard(title: "Stock Items", value: "\(appVM.appData.stock.count)")
                            StatCard(title: "Businesses", value: "\(appVM.appData.businesses.count)")
                        }
                    } else {
                        Text("No business selected")
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
            }
            .navigationTitle("Argus")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { Task { await appVM.syncFromCloud() } }) {
                        Image(systemName: "arrow.clockwise.icloud")
                    }
                }
            }
        }
    }
}

private struct StatCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack {
            Text(value).font(.title).fontWeight(.bold)
            Text(title).font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
