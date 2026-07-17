# Argus iOS App (Scaffold)

This is a scaffold for the future Argus iOS app. It defines the project structure,
data models, and API client that will be used to sync with the Argus backend.

## Project Structure

```
ArgusiOS/
├── ArgusiOSApp.swift         # App entry point
├── Models/
│   ├── AppData.swift          # Core data models (Invoice, Business, Party, StockItem)
│   └── AppSettings.swift      # User settings model
├── Networking/
│   ├── APIClient.swift        # Firebase REST API client for data sync
│   └── AuthManager.swift      # Firebase Auth wrapper
├── Views/
│   ├── DashboardView.swift    # Main dashboard
│   ├── InvoiceListView.swift  # Invoice list
│   ├── InvoiceFormView.swift  # Create/edit invoice
│   ├── ScannerView.swift      # Barcode scanner using AVFoundation
│   └── SettingsView.swift     # User settings + cloud sync
├── ViewModels/
│   ├── AppViewModel.swift     # Main app state manager
│   └── SyncManager.swift      # Cloud sync coordinator
└── Resources/
    └── Info.plist
```

## Data Sync

The iOS app will use the same Firebase Cloud Functions endpoints as the web app:

- `GET /api/data/load` — Load app data from Firestore
- `POST /api/data/save` — Save app data to Firestore
- `POST /api/auth/sync` — Sync user profile
- `GET/POST/DELETE /api/data/scan-result` — Phone-as-scanner for PC

All endpoints require a Firebase ID token in the `Authorization: Bearer <token>` header.

## Dependencies (planned)

- Firebase iOS SDK (Auth, Firestore)
- AVFoundation (for barcode scanning)
- SwiftUI for UI

## Getting Started

1. Open `ArgusiOS.xcodeproj` in Xcode
2. Configure Firebase project (same Firebase project as web app)
3. Add `GoogleService-Info.plist` to the project
4. Build and run on device (camera required for scanning)
