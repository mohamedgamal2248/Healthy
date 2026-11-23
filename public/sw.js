// Healthy service worker: installable app + Web Push reminders. It deliberately caches nothing,
// so users always get the latest version and no stale data can be shown.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore malformed payloads */ }
  const title = typeof data.title === "string" && data.title ? data.title : "Healthy";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "healthy-daily",
      data: { url: "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    }),
  );
});
