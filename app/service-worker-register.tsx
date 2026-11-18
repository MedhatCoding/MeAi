"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {
      // Offline support is progressive enhancement; the app remains usable online.
    });
  }, []);
  return null;
}
