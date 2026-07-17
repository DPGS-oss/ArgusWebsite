# Argus Android (Flutter) — Cloud Sync Integration

## Overview

The Argus Android app is a Flutter app located at `c:\Users\devan\Desktop\Argus\argus\`.
It uses the same Firebase project (`argus-invocing`) as the Argus web app.
Cloud sync has been integrated directly into the Flutter app using the
`cloud_firestore` package (already a dependency).

## What Was Added

### 1. `lib/services/sync/cloud_sync_service.dart`
A new service that reads/writes to the same Firestore document the web app uses:
- **Path**: `users/{uid}/app_data/main`
- **Methods**:
  - `syncFromCloud()` — Pulls cloud data, merges with local Hive store (union by ID, newest wins)
  - `syncToCloud()` — Uploads local invoices, customers, inventory, templates to Firestore
  - `postScanResult(code)` — Posts a barcode to `users/{uid}/scan_results/latest` for phone-as-scanner
  - `getScanResult()` — Polls for a scan result (when receiving from phone)
  - `clearScanResult()` — Clears the scan result after consuming

### 2. `lib/state/app_state.dart` — Integration
- `CloudSyncService` initialized in `inject()` alongside the existing `SyncService`
- **Auto-pull on login**: `syncFromCloud()` called after Firebase auth restore
- **Auto-upload on data change**: Debounced 3-second timer uploads to Firestore after
  any invoice/customer/inventory/template create/delete operation
- **Public methods for UI**:
  - `cloudSyncNow()` — Full bidirectional sync (pull then push)
  - `cloudSyncUpload()` — Manual upload only
  - `postScanResultToCloud(code)` — Phone-as-scanner support
  - `getScanResultFromCloud()` — Receive scan from phone
  - `clearScanResultFromCloud()` — Clear consumed scan result
- **State variables**: `cloudSyncing`, `cloudLastSyncAt` for UI feedback

### 3. `lib/screens/settings/settings_screen.dart` — Cloud Sync UI
- New "Cloud Sync" section in Settings with:
  - Sync status indicator (syncing / last synced time)
  - "Sync Now" button (bidirectional)
  - "Upload" button (push only)
  - "Scan for Web App" button (opens scanner in phone-as-scanner mode)

### 4. `lib/screens/inventory/barcode_scan_screen.dart` — Enhanced
- Added `scanForWeb` parameter
- When `scanForWeb: true`, scanned barcodes are posted to Firestore instead of
  returned via Navigator.pop, enabling the phone to act as a scanner for the
  PC web app

## Data Flow

```
Flutter App (Hive local store)
    ↕ (CloudSyncService)
Firestore: users/{uid}/app_data/main
    ↕ (cloud-sync.ts / Cloud Functions)
Web App (localStorage)
```

## Merge Strategy

- **Invoices**: Union by ID, prefer the one with newer `createdAt`
- **Customers**: Union by ID, prefer the one with more data (longer name heuristic)
- **Inventory**: Union by ID, prefer the one with higher `stockOnHand`
- **Templates**: Union by ID, local-first for ties

## Firestore Security

The Firestore rules (in `firestore.rules` on the web app repo) restrict access to
`users/{uid}/app_data/*` and `users/{uid}/scan_results/*` to the authenticated
owner only. Both the Flutter app and web app use Firebase Auth with the same
project, so the same UID is used across platforms.

## Phone-as-Scanner Flow

1. User opens web app on PC, clicks "Scan" → chooses "Use phone as scanner"
2. Web app generates a QR code linking to `/scan` page
3. User opens Argus Android app → Settings → Cloud Sync → "Scan for Web App"
4. User scans a barcode on the phone
5. Barcode is posted to `users/{uid}/scan_results/latest` in Firestore
6. Web app polls this document and receives the barcode
7. Web app clears the scan result and fills the barcode field

## No Changes Needed to pubspec.yaml

The following packages were already present:
- `cloud_firestore: ^5.4.4` — Firestore access
- `firebase_auth: ^5.3.1` — Authentication (for UID)
- `mobile_scanner: ^6.0.2` — Barcode scanning
- `qr_flutter: ^4.1.0` — QR code generation (for future use)
