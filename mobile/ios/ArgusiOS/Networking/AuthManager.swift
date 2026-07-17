import Foundation
import FirebaseAuth

class AuthManager: ObservableObject {
    @Published var user: User?
    @Published var token: String?
    @Published var isReady = false

    init() {
        Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.user = user
            if let user = user {
                user.getIDToken { token, _ in
                    self?.token = token
                    self?.isReady = true
                }
            } else {
                self?.token = nil
                self?.isReady = true
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func signUp(name: String, email: String, password: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        let changeRequest = result.user.createProfileChangeRequest()
        changeRequest.displayName = name
        try await changeRequest.commitChanges()
    }

    func signOut() {
        try? Auth.auth().signOut()
    }
}
