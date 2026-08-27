"use client";

import { useEffect } from "react";

const CANONICAL_HOST = "argusinvoicing.com";
const ALIAS_HOSTS = new Set([
  "www.argusinvoicing.com",
  "argus-invocing.web.app",
  "argus-invocing.firebaseapp.com",
]);

export function CanonicalHostRedirect() {
  useEffect(() => {
    const { hostname, pathname, search, hash } = window.location;
    if (!ALIAS_HOSTS.has(hostname)) return;
    window.location.replace(`https://${CANONICAL_HOST}${pathname}${search}${hash}`);
  }, []);
  return null;
}
