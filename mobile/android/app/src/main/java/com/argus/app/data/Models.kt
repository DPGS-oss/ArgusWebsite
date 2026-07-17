package com.argus.app.data

import com.google.gson.annotations.SerializedName

data class AppData(
    @SerializedName("businesses") val businesses: List<BusinessProfile> = emptyList(),
    @SerializedName("parties") val parties: List<Party> = emptyList(),
    @SerializedName("invoices") val invoices: List<Invoice> = emptyList(),
    @SerializedName("stock") val stock: List<StockItem> = emptyList(),
    @SerializedName("activeBusinessId") val activeBusinessId: String? = null,
    @SerializedName("invoiceCounter") val invoiceCounter: Int = 0,
    @SerializedName("settings") val settings: AppSettings = AppSettings()
)

data class BusinessProfile(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("gstin") val gstin: String = "",
    @SerializedName("pan") val pan: String = "",
    @SerializedName("email") val email: String = "",
    @SerializedName("phone") val phone: String = "",
    @SerializedName("address") val address: String = "",
    @SerializedName("city") val city: String = "",
    @SerializedName("state") val state: String = "",
    @SerializedName("stateCode") val stateCode: String = "",
    @SerializedName("pincode") val pincode: String = "",
    @SerializedName("bankName") val bankName: String = "",
    @SerializedName("bankAccount") val bankAccount: String = "",
    @SerializedName("bankIfsc") val bankIfsc: String = "",
    @SerializedName("bankBranch") val bankBranch: String = "",
    @SerializedName("upiId") val upiId: String = ""
)

data class Party(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("gstin") val gstin: String = "",
    @SerializedName("email") val email: String = "",
    @SerializedName("phone") val phone: String = "",
    @SerializedName("address") val address: String = "",
    @SerializedName("city") val city: String = "",
    @SerializedName("state") val state: String = "",
    @SerializedName("stateCode") val stateCode: String = "",
    @SerializedName("pincode") val pincode: String = "",
    @SerializedName("businessId") val businessId: String = ""
)

data class Invoice(
    @SerializedName("id") val id: String,
    @SerializedName("invoiceNumber") val invoiceNumber: String,
    @SerializedName("businessId") val businessId: String,
    @SerializedName("partyId") val partyId: String,
    @SerializedName("partyName") val partyName: String,
    @SerializedName("date") val date: String,
    @SerializedName("type") val type: String,
    @SerializedName("status") val status: String,
    @SerializedName("items") val items: List<InvoiceItem> = emptyList(),
    @SerializedName("subtotal") val subtotal: Double = 0.0,
    @SerializedName("cgstAmount") val cgstAmount: Double = 0.0,
    @SerializedName("sgstAmount") val sgstAmount: Double = 0.0,
    @SerializedName("igstAmount") val igstAmount: Double = 0.0,
    @SerializedName("roundOff") val roundOff: Double = 0.0,
    @SerializedName("grandTotal") val grandTotal: Double = 0.0,
    @SerializedName("notes") val notes: String = "",
    @SerializedName("terms") val terms: String = "",
    @SerializedName("paymentTerms") val paymentTerms: String = "",
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

data class InvoiceItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("hsn") val hsn: String = "",
    @SerializedName("quantity") val quantity: Double = 0.0,
    @SerializedName("unit") val unit: String = "",
    @SerializedName("rate") val rate: Double = 0.0,
    @SerializedName("gstRate") val gstRate: Double = 0.0,
    @SerializedName("gstAmount") val gstAmount: Double = 0.0,
    @SerializedName("total") val total: Double = 0.0
)

data class StockItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("hsn") val hsn: String = "",
    @SerializedName("unit") val unit: String = "",
    @SerializedName("currentStock") val currentStock: Double = 0.0,
    @SerializedName("minStock") val minStock: Double = 0.0,
    @SerializedName("rate") val rate: Double = 0.0,
    @SerializedName("gstRate") val gstRate: Double = 0.0,
    @SerializedName("barcode") val barcode: String? = null
)

data class AppSettings(
    @SerializedName("theme") val theme: String = "light",
    @SerializedName("currency") val currency: String = "INR",
    @SerializedName("invoicePrefix") val invoicePrefix: String = "INV",
    @SerializedName("invoiceSuffix") val invoiceSuffix: String = "",
    @SerializedName("defaultGstRate") val defaultGstRate: Double = 18.0,
    @SerializedName("defaultPaymentTerms") val defaultPaymentTerms: String = "30",
    @SerializedName("defaultNotes") val defaultNotes: String = "",
    @SerializedName("defaultTerms") val defaultTerms: String = "",
    @SerializedName("roundOff") val roundOff: Boolean = false,
    @SerializedName("folderName") val folderName: String = "ArgusInvoices"
)
