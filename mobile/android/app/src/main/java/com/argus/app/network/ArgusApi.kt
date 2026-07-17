package com.argus.app.network

import com.argus.app.data.AppData
import retrofit2.Response
import retrofit2.http.*

interface ArgusApi {
    @GET("apiDataLoad")
    suspend fun loadAppData(@Header("Authorization") token: String): Response<DataLoadResponse>

    @POST("apiDataSave")
    suspend fun saveAppData(
        @Header("Authorization") token: String,
        @Body body: SaveRequestBody
    ): Response<SaveResponse>

    @GET("apiDataScanResult")
    suspend fun getScanResult(@Header("Authorization") token: String): Response<ScanResultResponse>

    @POST("apiDataScanResult")
    suspend fun postScanResult(
        @Header("Authorization") token: String,
        @Body body: ScanResultBody
    ): Response<SaveResponse>

    @DELETE("apiDataScanResult")
    suspend fun clearScanResult(@Header("Authorization") token: String): Response<SaveResponse>

    @POST("apiAuthSync")
    suspend fun syncAuth(
        @Header("Authorization") token: String,
        @Body body: AuthSyncBody?
    ): Response<AuthSyncResponse>
}

data class DataLoadResponse(
    val data: AppData? = null,
    val updated_at: String? = null,
    val version: Int = 0
)

data class SaveRequestBody(
    val appData: AppData,
    val version: Int = 1,
    val device: String = "android-app"
)

data class SaveResponse(
    val success: Boolean = false,
    val updated_at: String? = null
)

data class ScanResultResponse(
    val code: String? = null,
    val timestamp: String? = null
)

data class ScanResultBody(
    val code: String
)

data class AuthSyncBody(
    val name: String? = null
)

data class AuthSyncResponse(
    val user: Map<String, Any?>? = null,
    val requires_subscription: Boolean = false
)
