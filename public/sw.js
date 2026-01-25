const CACHE_VERSION = "myfinance-v1.0.7"; // atualize quando mudar APP_SHELL
const CACHE_NAME = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Mantem esta lista sincronizada com os arquivos reais em /public
const APP_SHELL = [
  "/",
  "/index.html",
  "/transactions.html",
  "/register.html",
  "/verify-email.html",
  "/reset-password.html",
  "/navbar.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/css/navbar.css",
  "/assets/css/transactions.css",
  "/assets/css/pwa-install.css",
  "/js/api.js",
  "/js/utils.js",
  "/js/idleLogout.js",
  "/js/transactions.js",
  "/js/loadNavbar.js",
  "/js/profileMenu.js",
  "/js/pwa.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/maskable-192.png",
  "/assets/icons/maskable-512.png",
];

const API_PATH_PREFIXES = [
  "/transactions",
  "/categories",
  "/auth",
  "/dashboard",
  "/box",
  "/family",
];

// API_ORIGINS e carregado dinamicamente via /config.json (server.js)
let apiOrigins = new Set();

async function loadApiOrigins() {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    const data = await res.json();
    const apiUrl = (data?.apiUrl || "").trim();
    if (apiUrl) {
      const origin = new URL(apiUrl).origin;
      apiOrigins.add(origin);
    }
  } catch {
    // ignore: sem config, segue com fallback
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await loadApiOrigins();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await loadApiOrigins();
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k.startsWith(CACHE_VERSION) ? null : caches.delete(k)))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isApiRequest(req) {
  const url = new URL(req.url);

  if (apiOrigins.has(url.origin)) return true;
  // Fallback seguro: se for cross-origin, trata como API (network-only)
  if (url.origin !== self.location.origin) return true;

  if (url.origin === self.location.origin) {
    return API_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
  }

  return false;
}

function isHTML(req) {
  return (
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html")
  );
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirstHTML(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const offline = await caches.match("/offline.html", { ignoreSearch: true });
    if (offline) return offline;
    const cached = await caches.match(req);
    if (cached) return cached;
    return await caches.match("/index.html");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (isApiRequest(req)) {
    event.respondWith(fetch(req));
    return;
  }

  if (isHTML(req)) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});
