const CACHE_PREFIX = `ldhealth-dashboard:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const DASHBOARD = new URL("./index.html", self.registration.scope).href;
const LOCAL_ASSETS = [
    "./index.html",
    "./manifest.webmanifest",
    "./logo_LD.png",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
].map(path => new URL(path, self.registration.scope).href);
const LIBRARIES = [
    "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js"
];
const DASHBOARD_ROUTES = new Set([
    new URL(self.registration.scope).pathname,
    new URL(DASHBOARD).pathname
]);

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(LOCAL_ASSETS.map(url => new Request(url, { cache: "reload" })));
        await Promise.allSettled(LIBRARIES.map(url => cache.add(url)));
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (request.mode === "navigate" && url.origin === self.location.origin &&
        DASHBOARD_ROUTES.has(url.pathname)) {
        event.respondWith(fetch(request).catch(async () => {
            const cache = await caches.open(CACHE_NAME);
            return cache.match(DASHBOARD);
        }));
        return;
    }

    if (LOCAL_ASSETS.includes(request.url) || LIBRARIES.includes(request.url)) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            if (cached) return cached;

            const response = await fetch(request);
            if (response.ok) {
                try {
                    await cache.put(request, response.clone());
                } catch (error) {
                    console.warn("Falha ao salvar recurso para uso offline.", error);
                }
            }
            return response;
        })());
    }
});
