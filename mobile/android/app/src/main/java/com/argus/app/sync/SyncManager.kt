package com.argus.app.sync

import com.argus.app.data.AppData
import com.argus.app.network.ArgusApi
import com.argus.app.network.DataLoadResponse
import com.argus.app.network.SaveRequestBody
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncManager(private val api: ArgusApi) {

    suspend fun syncFromCloud(token: String): AppData? = withContext(Dispatchers.IO) {
        try {
            val response = api.loadAppData("Bearer $token")
            if (response.isSuccessful) response.body()?.data else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun syncToCloud(token: String, data: AppData): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = SaveRequestBody(appData = data, version = 1, device = "android-app")
            val response = api.saveAppData("Bearer $token", body)
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }

    suspend fun postScanResult(token: String, code: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val response = api.postScanResult("Bearer $token", com.argus.app.network.ScanResultBody(code))
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }
}
