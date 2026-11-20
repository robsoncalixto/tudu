/* CACHE is set by the service worker route for this build. */
const offlinePage = (locale) => `/offline?lang=${locale}`;
const preference = "/offline-locale";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([offlinePage("en"), offlinePage("pt-BR"), "/brand/tudu-icon-192.png"]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("tudu-shell-") && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const locale = event.data?.locale;
  if (locale !== "en" && locale !== "pt-BR") return;
  event.waitUntil(caches.open(CACHE).then((cache) => cache.put(preference, new Response(locale))).catch(() => undefined));
});

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE);
    const remembered = await (await cache.match(preference))?.text();
    const locale = remembered === "pt-BR" || (!remembered && self.navigator.language.toLowerCase().startsWith("pt")) ? "pt-BR" : "en";
    return (await cache.match(offlinePage(locale))) ?? Response.error();
  }
}

async function staticAsset(request) {
  const cache = await caches.open(CACHE).catch(() => null);
  const cached = await cache?.match(request).catch(() => undefined);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && !response.redirected && response.headers.get("Cache-Control")?.includes("immutable")) {
    await cache?.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;
  if (request.mode === "navigate") event.respondWith(navigate(request));
  else if (url.pathname.startsWith("/_next/static/") || url.pathname === "/brand/tudu-icon-192.png") {
    event.respondWith(staticAsset(request));
  }
});
