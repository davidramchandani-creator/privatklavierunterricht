"use client";

import { useEffect } from "react";

export default function PwaInit() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // SW registration failed silently; app still works normally
        });
    }
  }, []);
  return null;
}
