"use client";

import { useEffect } from "react";

/**
 * Attaches the stored account token to AI-cost API calls so the server-side
 * auth gate (app/api/_lib/api-access.ts) can authorize the signed-in user.
 * Intercepts only same-origin API paths that need it; never touches other
 * origins or paths that manage their own Authorization header explicitly.
 */
const PROTECTED_PATHS = [
  "/api/chat",
  "/api/search",
  "/api/research",
  "/api/images/generate",
  "/api/agent/plan",
  "/api/agent/code",
  "/api/agent/artifact",
  "/api/agent/execute",
];

export default function AuthFetchProvider() {
  useEffect(() => {
    if ((window as unknown as { __meaiAuthFetchPatched?: boolean }).__meaiAuthFetchPatched) return;
    (window as unknown as { __meaiAuthFetchPatched?: boolean }).__meaiAuthFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = new URL(url, window.location.origin);
        if (path.origin === window.location.origin && PROTECTED_PATHS.includes(path.pathname)) {
          const token = sessionStorage.getItem("meai-access-token") || "";
          const hasAuthHeader = Boolean(init?.headers && (
            (init.headers instanceof Headers && init.headers.has("Authorization")) ||
            (Array.isArray(init.headers) && init.headers.some(([k]) => k.toLowerCase() === "authorization")) ||
            (typeof init.headers === "object" && Object.keys(init.headers).some((k) => k.toLowerCase() === "authorization"))
          ));
          if (token && !hasAuthHeader) {
            const headers = new Headers(init?.headers || {});
            headers.set("Authorization", `Bearer ${token}`);
            init = { ...(init || {}), headers };
          }
        }
      } catch { /* Never block the request because of interceptor issues. */ }
      return originalFetch(input as RequestInfo, init as RequestInit);
    };
  }, []);
  return null;
}
