/**
 * Client-side AES-GCM helpers for CA book shares.
 * Encryption key stays in the invite URL hash — never sent to the server.
 */

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

export async function generateCaShareKey(): Promise<string> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToB64(raw);
}

async function importKey(b64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64ToBuf(b64Key), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptBooksPayload(
  data: unknown,
  b64Key: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(b64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ciphertext: bufToB64(cipher), iv: bufToB64(iv.buffer) };
}

export async function decryptBooksPayload(
  ciphertext: string,
  iv: string,
  b64Key: string,
): Promise<unknown> {
  const key = await importKey(b64Key);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(iv)) },
    key,
    b64ToBuf(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

const CA_KEY_STORAGE = "argus_ca_share_key";

export function storeCaShareKey(ownerId: string, key: string): void {
  sessionStorage.setItem(`${CA_KEY_STORAGE}:${ownerId}`, key);
}

export function loadCaShareKey(ownerId: string): string | null {
  return sessionStorage.getItem(`${CA_KEY_STORAGE}:${ownerId}`);
}

export function readKeyFromLocationHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get("key");
}
