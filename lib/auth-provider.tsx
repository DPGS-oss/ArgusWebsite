"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { getFirebaseAuth, initFirebase } from "./firebase";
import { isSubscriptionActive, type SubscriptionInfo } from "./subscription";
import {
  SUB_CACHE_KEY,
  parseCachedSubscription,
  keepSubscriptionOnSyncFailure,
} from "./entitlement";

export type AppUser = {
  name: string;
  email: string;
  business_name?: string;
  gstin?: string;
  phone?: string;
  subscription?: SubscriptionInfo;
  referralCode?: string;
  referredBy?: string;
  trial_used?: boolean;
  trial_started_at?: string;
};

type AuthContextValue = {
  user: AppUser | null;
  firebaseUser: User | null;
  token: string | null;
  authReady: boolean;
  authConfigured: boolean;
  showAuthModal: boolean;
  showProfileModal: boolean;
  setShowAuthModal: (open: boolean) => void;
  setShowProfileModal: (open: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLocalUser: (patch: Partial<AppUser>) => void;
};

const BUSINESS_ONLY_VIEWS = ["purchases", "expenses", "credit-notes", "recurring", "reports"];

export type PlanLevel = "free" | "business";

export function getPlanLevel(user: AppUser | null): PlanLevel {
  if (isSubscriptionActive(user?.subscription)) return "business";
  return "free";
}

export function isFeatureUnlocked(view: string, user: AppUser | null): boolean {
  const level = getPlanLevel(user);
  if (level === "business") return true;
  return !BUSINESS_ONLY_VIEWS.includes(view);
}

export function hasValidSubscription(user: AppUser | null): boolean {
  return isSubscriptionActive(user?.subscription);
}

function readCachedSubscription(): SubscriptionInfo | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseCachedSubscription(sessionStorage.getItem(SUB_CACHE_KEY)) as SubscriptionInfo | undefined;
  } catch {
    return undefined;
  }
}

function writeCachedSubscription(sub: SubscriptionInfo | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (sub) sessionStorage.setItem(SUB_CACHE_KEY, JSON.stringify(sub));
    else sessionStorage.removeItem(SUB_CACHE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapBackendUser(u: Record<string, unknown>): AppUser {
  const sub = u.subscription as Record<string, unknown> | null | undefined;
  return {
    name: String(u.name || ""),
    email: String(u.email || ""),
    business_name: u.business_name ? String(u.business_name) : undefined,
    gstin: u.gstin ? String(u.gstin) : undefined,
    phone: u.phone ? String(u.phone) : undefined,
    subscription: sub
      ? {
          plan: sub.plan ? String(sub.plan) : undefined,
          plan_key: String(sub.plan_key ?? sub.plan ?? ""),
          details: sub.details ? String(sub.details) : undefined,
          active: sub.active === true,
          expiry_date:
            (sub.expiry_date as string | null | undefined) ??
            (sub.expiryDate as string | null | undefined) ??
            null,
        }
      : undefined,
    referralCode: u.referral_code ? String(u.referral_code) : undefined,
    referredBy: u.referred_by ? String(u.referred_by) : undefined,
    trial_used: u.trial_used === true,
    trial_started_at: u.trial_started_at ? String(u.trial_started_at) : undefined,
  };
}

async function syncUserWithBackend(token: string, name?: string): Promise<AppUser | null> {
  const response = await fetch("/api/auth/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: name ? JSON.stringify({ name }) : undefined,
  });

  if (!response.ok) return null;
  const data = await response.json();
  const u = data.user;
  if (!u) return null;
  return mapBackendUser(u);
}

/** Lightweight profile refresh (avoids hourly auth/sync rate limit). */
async function fetchUserProfile(token: string): Promise<AppUser | null> {
  const response = await fetch("/api/user/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const u = data.user;
  if (!u) return null;
  return mapBackendUser(u);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    initFirebase().then((configured) => {
      setAuthConfigured(configured);
      if (!configured) {
        setAuthReady(true);
        return;
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        setAuthReady(true);
        return;
      }

      getRedirectResult(auth).catch(() => {
        /* popup-blocked browsers finish Google sign-in via redirect */
      });

      unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        setFirebaseUser(nextUser);
        if (nextUser) {
          const idToken = await nextUser.getIdToken();
          setToken(idToken);
          const synced = await syncUserWithBackend(idToken);
          if (synced) {
            writeCachedSubscription(synced.subscription);
            setUser(synced);
          } else {
            setUser((prev) => {
              const cached = keepSubscriptionOnSyncFailure(
                prev?.subscription ?? readCachedSubscription(),
                undefined,
              );
              return {
                name: nextUser.displayName || nextUser.email?.split("@")[0] || prev?.name || "User",
                email: nextUser.email || prev?.email || "",
                business_name: prev?.business_name,
                gstin: prev?.gstin,
                phone: prev?.phone,
                subscription: cached,
                referralCode: prev?.referralCode,
                referredBy: prev?.referredBy,
              };
            });
          }
        } else {
          setToken(null);
          setUser(null);
          writeCachedSubscription(undefined);
        }
        setAuthReady(true);
      });
    });

    return () => unsubscribe?.();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Authentication is not configured yet.");
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();
    const synced = await syncUserWithBackend(idToken);
    if (!synced) throw new Error("Failed to sync user data");
    setToken(idToken);
    writeCachedSubscription(synced.subscription);
    setUser(synced);
    setShowAuthModal(false);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Authentication is not configured yet.");
    const provider = new GoogleAuthProvider();
    let credential;
    try {
      credential = await signInWithPopup(auth, provider);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      const message = err instanceof Error ? err.message : String(err || "");
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        /popup|blocked/i.test(`${code} ${message}`)
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
    const idToken = await credential.user.getIdToken();
    const synced = await syncUserWithBackend(idToken, credential.user.displayName || undefined);
    if (!synced) throw new Error("Failed to sync user data");
    setToken(idToken);
    writeCachedSubscription(synced.subscription);
    setUser(synced);
    setShowAuthModal(false);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Authentication is not configured yet.");
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      const idToken = await credential.user.getIdToken();
      const synced = await syncUserWithBackend(idToken, name);
      if (!synced) throw new Error("Registration succeeded but failed to sync user data");
      setToken(idToken);
      writeCachedSubscription(synced.subscription);
      setUser(synced);
      setShowAuthModal(false);
    },
    []
  );

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setToken(null);
    setUser(null);
    writeCachedSubscription(undefined);
    setShowProfileModal(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    const synced = (await fetchUserProfile(idToken)) || (await syncUserWithBackend(idToken));
    if (synced) {
      writeCachedSubscription(synced.subscription);
      setUser(synced);
    }
  }, [firebaseUser]);

  const updateLocalUser = useCallback((patch: Partial<AppUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      token,
      authReady,
      authConfigured,
      showAuthModal,
      showProfileModal,
      setShowAuthModal,
      setShowProfileModal,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshProfile,
      updateLocalUser,
    }),
    [
      user,
      firebaseUser,
      token,
      authReady,
      authConfigured,
      showAuthModal,
      showProfileModal,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshProfile,
      updateLocalUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
