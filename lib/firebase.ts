import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

type FirebaseConfig = {
  firebase_api_key: string;
  firebase_auth_domain: string;
  firebase_project_id: string;
  firebase_app_id: string;
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export async function initFirebase(): Promise<boolean> {
  if (app) return true;

  try {
    const response = await fetch("/api/config");
    if (!response.ok) return false;
    const config = (await response.json()) as FirebaseConfig;
    if (!config.firebase_api_key || !config.firebase_project_id) return false;

    app =
      getApps()[0] ??
      initializeApp({
        apiKey: config.firebase_api_key,
        authDomain: config.firebase_auth_domain,
        projectId: config.firebase_project_id,
        appId: config.firebase_app_id,
      });
    auth = getAuth(app);
    return true;
  } catch {
    return false;
  }
}

export function getFirebaseAuth() {
  return auth;
}
