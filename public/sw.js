// Gym Davomat — service worker (offline + push)
const CACHE = "gym-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Navigatsiya uchun network-first, oflaynda keshdan.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
  }
});

// Push bildirishnoma keldi.
self.addEventListener("push", (e) => {
  let data = { title: "Gym Davomat", body: "", url: "/" };
  try {
    data = e.data.json();
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [80, 40, 80],
      data: { url: data.url || "/" },
    }),
  );
});

// Bildirishnoma bosilganda saytni ochamiz.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
