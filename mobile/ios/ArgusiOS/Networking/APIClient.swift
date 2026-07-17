import Foundation

class APIClient {
    static let shared = APIClient()

    private let baseURL: String

    init(baseURL: String = "https://us-central1-argus-website.cloudfunctions.net") {
        self.baseURL = baseURL
    }

    func loadAppData(token: String) async throws -> AppData? {
        let url = URL(string: "\(baseURL)/apiDataLoad")!
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }

        let result = try JSONDecoder().decode(DataLoadResponse.self, from: data)
        return result.data
    }

    func saveAppData(token: String, data: AppData) async throws -> Bool {
        let url = URL(string: "\(baseURL)/apiDataSave")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = SaveRequestBody(appData: data, version: 1, device: "ios-app")
        req.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { return false }
        return http.statusCode == 200
    }

    func postScanResult(token: String, code: String) async throws -> Bool {
        let url = URL(string: "\(baseURL)/apiDataScanResult")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ScanResultBody(code: code)
        req.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { return false }
        return http.statusCode == 200
    }
}

private struct DataLoadResponse: Decodable {
    let data: AppData?
    let updated_at: String?
    let version: Int?
}

private struct SaveRequestBody: Encodable {
    let appData: AppData
    let version: Int
    let device: String
}

private struct ScanResultBody: Encodable {
    let code: String
}
