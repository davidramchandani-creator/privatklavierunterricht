// Service Worker – Privatklavierunterricht Portal
// Caches portal and admin routes for offline use.
// Strategy: Network-first for navigation, cache-first for static assets.

const CACHE_NAME = "piano-portal-v2";
const OFFLINE_URL = "/offline";

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Routes served from cache when offline (navigation requests only)
const PORTAL_ORIGINS = ["/schueler/", "/admin/", "/auth/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET, API routes, and Supabase calls
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) {
    // Static assets: cache-first
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation to portal/admin: network-first with offline fallback
  if (
    request.mode === "navigate" &&
    PORTAL_ORIGINS.some((p) => url.pathname.startsWith(p))
  ) {
    event.respondWith(networkFirstNav(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}


// ── Push-Benachrichtigungen ──────────────────────────────────────────
// Der Server sendet ein JSON-Payload: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Klavierunterricht", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Klavierunterricht";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Gleiche tag ersetzt eine vorherige Nachricht statt zu stapeln.
    tag: data.tag || "allgemein",
    renotify: true,
    data: { url: data.url || "/schueler/portal" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Klick auf die Benachrichtigung: bestehenden Tab fokussieren, sonst oeffnen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/schueler/portal";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
