const CACHE_NAME = "sistema-manutencao-v17";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest_v10.json",
  "./icon-192-v10.png",
  "./icon-512-v10.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("sistema-manutencao-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const appRoot = new URL("./", self.registration.scope).pathname;
    const appIndex = new URL("./index.html", self.registration.scope).pathname;
    if (requestUrl.pathname !== appRoot && requestUrl.pathname !== appIndex) {
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put("./index.html", copy),
            );
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("./index.html");
        }),
    );
    return;
  }

  const isAppShellAsset = APP_SHELL.some((asset) =>
    requestUrl.pathname.endsWith(asset.replace(/^\.\//, "")),
  );
  if (!isAppShellAsset) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Sistema de Manutenção",
      {
        body: data.body || "Há uma atualização em um chamado.",
        icon: "./icon-192-v10.png",
        badge: "./icon-192-v10.png",
        data: { url: data.url || "./", callId: data.callId || null },
        tag: data.tag || "maintenance-update",
        renotify: true,
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "./";
  event.waitUntil((async () => {
    const targetUrl = new URL(target, self.registration.scope).href;
    const appOrigin = new URL(self.registration.scope).origin;
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of list) {
      if (new URL(client.url).origin !== appOrigin) continue;
      if ("navigate" in client) {
        try { await client.navigate(targetUrl); } catch { /* Keep focusing the open app. */ }
      }
      return client.focus();
    }
    return clients.openWindow(targetUrl);
  })());
});
