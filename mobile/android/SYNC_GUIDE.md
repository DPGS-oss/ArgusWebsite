# Argus Android App — Cloud Sync Integration Guide

This document describes how the Argus Android app should integrate with the
Firebase Cloud Functions backend to enable cross-device data synchronization
with the Argus web app.

## Architecture

Both the Android app and the web app share the same Firebase backend:

- **Firebase Auth** — User authentication (email/password, Google Sign-In)
- **Firestore** — User profiles (`users/{uid}`) and app data (`users/{uid}/app_data/main`)
- **Cloud Functions** — REST API endpoints for data sync, auth, payments

## API Endpoints

All endpoints require `Authorization: Bearer <firebase_id_token>` header.

### Load App Data
```
GET /apiDataLoad
Response: { data: AppData, updated_at: string, version: int }
```

### Save App Data
```
POST /apiDataSave
Body: { appData: AppData, version: int, device: string }
Response: { success: boolean, updated_at: string }
```

### Scan Result (phone-as-scanner for PC)
```
GET /apiDataScanResult    → { code: string|null, timestamp: string|null }
POST /apiDataScanResult   → Body: { code: string }
DELETE /apiDataScanResult → { success: boolean }
```

### Auth Sync
```
POST /apiAuthSync
Body: { name?: string }
Response: { user: UserProfile, requires_subscription: boolean }
```

### User Profile
```
GET /apiUserProfile    → { user: UserProfile }
PUT /apiUserProfile    → Body: { business_name?, gstin?, phone? }
```

## Data Model (Kotlin)

```kotlin
data class AppData(
    val businesses: List<BusinessProfile> = emptyList(),
    val parties: List<Party> = emptyList(),
    val invoices: List<Invoice> = emptyList(),
    val stock: List<StockItem> = emptyList(),
    val activeBusinessId: String? = null,
    val invoiceCounter: Int = 0,
    val settings: AppSettings = AppSettings()
)
```

## Sync Strategy

1. **On app launch**: Call `GET /apiDataLoad` to fetch cloud data. Merge with
   local Room database data (newest `updatedAt` wins per item).
2. **On data change**: Debounce 2 seconds, then call `POST /apiDataSave` with
   the full `AppData` payload.
3. **On manual sync**: User can trigger sync from settings — pull from cloud,
   merge, then push merged result back.
4. **Conflict resolution**: Compare `updatedAt` timestamps per item. Cloud wins
   if `cloud.updatedAt > local.updatedAt`. New items from either side are kept.

## Implementation Checklist

- [ ] Add Firebase Auth SDK to Android app
- [ ] Implement `APIClient` class with Retrofit/OkHttp
- [ ] Create Room database entities matching `AppData` model
- [ ] Implement `SyncManager` with WorkManager for periodic sync
- [ ] Add barcode scanner using Google ML Kit Barcode Scanning API
- [ ] Implement phone-as-scanner: POST scan results to `/apiDataScanResult`
  so the PC web app can poll and receive them
- [ ] Handle auth token refresh (Firebase ID tokens expire after 1 hour)

## Firebase Configuration

Use the same Firebase project as the web app. Add `google-services.json` to
the Android app's `app/` directory. The Firebase project ID and API key can
be obtained from `GET /api/config` on the web app.

## Rate Limits

- `data_save`: 30 requests per minute per user
- `auth_sync`: 10 requests per hour per user
- `user_profile_put`: 5 requests per minute per user
