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

    const clean = (v: string) => (v || '').trim().replace(/[\r\n]/g, '');
    app =
      getApps()[0] ??
      initializeApp({
        apiKey: clean(config.firebase_api_key),
        authDomain: clean(config.firebase_auth_domain),
        projectId: clean(config.firebase_project_id),
        appId: clean(config.firebase_app_id),
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
