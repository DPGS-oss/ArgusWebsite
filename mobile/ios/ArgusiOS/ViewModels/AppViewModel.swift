import Foundation
import Combine

@MainActor
class AppViewModel: ObservableObject {
    @Published var appData: AppData
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSync: Date?

    private let apiClient = APIClient.shared
    var token: String?

    enum SyncStatus {
        case idle, syncing, synced, error
    }

    init() {
        self.appData = AppData(
            businesses: [], parties: [], invoices: [], stock: [],
            activeBusinessId: nil, invoiceCounter: 0,
            settings: AppSettings(
                theme: "light", currency: "INR", invoicePrefix: "INV",
                invoiceSuffix: "", defaultGstRate: 18,
                defaultPaymentTerms: "30", defaultNotes: "",
                defaultTerms: "", roundOff: false, folderName: "ArgusInvoices"
            )
        )
    }

    func syncFromCloud() async {
        guard let token = token else { return }
        syncStatus = .syncing
        do {
            if let cloudData = try await apiClient.loadAppData(token: token) {
                appData = cloudData
                syncStatus = .synced
                lastSync = Date()
            } else {
                syncStatus = .idle
            }
        } catch {
            syncStatus = .error
        }
    }

    func syncToCloud() async {
        guard let token = token else { return }
        syncStatus = .syncing
        do {
            let ok = try await apiClient.saveAppData(token: token, data: appData)
            syncStatus = ok ? .synced : .error
            if ok { lastSync = Date() }
        } catch {
            syncStatus = .error
        }
    }
}
