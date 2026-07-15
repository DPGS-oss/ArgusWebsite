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
} from "firebase/auth";
import { getFirebaseAuth, initFirebase } from "./firebase";

export type AppUser = {
  name: string;
  email: string;
  business_name?: string;
  gstin?: string;
  phone?: string;
  subscription?: { plan: string; details: string };
  referralCode?: string;
  referredBy?: string;
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

const ALLOWED_PLANS = ["business", "business_plus"];

export function hasValidSubscription(user: AppUser | null): boolean {
  return !!user?.subscription?.plan && ALLOWED_PLANS.includes(user.subscription.plan);
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  return {
    name: u.name || "",
    email: u.email || "",
    business_name: u.business_name,
    gstin: u.gstin,
    phone: u.phone,
    subscription: u.subscription,
    referralCode: u.referral_code,
    referredBy: u.referred_by,
  } as AppUser;
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

      unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        setFirebaseUser(nextUser);
        if (nextUser) {
          const idToken = await nextUser.getIdToken();
          setToken(idToken);
          const synced = await syncUserWithBackend(idToken);
          if (synced) {
            setUser(synced);
          } else {
            // Sync failed (e.g. rate limited) — fall back to Firebase user data
            // so the user isn't incorrectly treated as logged out
            setUser({
              name: nextUser.displayName || nextUser.email?.split("@")[0] || "User",
              email: nextUser.email || "",
            });
          }
        } else {
          setToken(null);
          setUser(null);
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
    setUser(synced);
    setShowAuthModal(false);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Authentication is not configured yet.");
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    const synced = await syncUserWithBackend(idToken, credential.user.displayName || undefined);
    if (!synced) throw new Error("Failed to sync user data");
    setToken(idToken);
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
    setShowProfileModal(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    const synced = await syncUserWithBackend(idToken);
    if (synced) setUser(synced);
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
