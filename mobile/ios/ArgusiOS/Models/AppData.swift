import Foundation

struct AppData: Codable {
    var businesses: [BusinessProfile]
    var parties: [Party]
    var invoices: [Invoice]
    var stock: [StockItem]
    var activeBusinessId: String?
    var invoiceCounter: Int
    var settings: AppSettings
}

struct BusinessProfile: Codable, Identifiable {
    var id: String
    var name: String
    var gstin: String
    var pan: String
    var email: String
    var phone: String
    var address: String
    var city: String
    var state: String
    var stateCode: String
    var pincode: String
    var bankName: String
    var bankAccount: String
    var bankIfsc: String
    var bankBranch: String
    var upiId: String
}

struct Party: Codable, Identifiable {
    var id: String
    var name: String
    var gstin: String
    var email: String
    var phone: String
    var address: String
    var city: String
    var state: String
    var stateCode: String
    var pincode: String
    var businessId: String
}

struct Invoice: Codable, Identifiable {
    var id: String
    var invoiceNumber: String
    var businessId: String
    var partyId: String
    var partyName: String
    var date: String
    var type: String
    var status: String
    var items: [InvoiceItem]
    var subtotal: Double
    var cgstAmount: Double
    var sgstAmount: Double
    var igstAmount: Double
    var roundOff: Double
    var grandTotal: Double
    var notes: String
    var terms: String
    var paymentTerms: String
    var createdAt: String
    var updatedAt: String?
}

struct InvoiceItem: Codable, Identifiable {
    var id: String
    var name: String
    var hsn: String
    var quantity: Double
    var unit: String
    var rate: Double
    var gstRate: Double
    var gstAmount: Double
    var total: Double
}

struct StockItem: Codable, Identifiable {
    var id: String
    var name: String
    var hsn: String
    var unit: String
    var currentStock: Double
    var minStock: Double
    var rate: Double
    var gstRate: Double
    var barcode: String?
}
