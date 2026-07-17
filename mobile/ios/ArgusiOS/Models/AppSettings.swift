import Foundation

struct AppSettings: Codable {
    var theme: String
    var currency: String
    var invoicePrefix: String
    var invoiceSuffix: String
    var defaultGstRate: Double
    var defaultPaymentTerms: String
    var defaultNotes: String
    var defaultTerms: String
    var roundOff: Bool
    var folderName: String
}
