// Service worker OMB Service: hanya menyimpan cangkang aplikasi. Data Supabase tidak pernah di-cache.
var V = "omb-v1";
var SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname.endsWith("supabase.co")) return; // data & auth selalu langsung ke jaringan
  var ok = u.origin === location.origin || u.hostname === "cdn.jsdelivr.net" || u.hostname === "cdnjs.cloudflare.com" ||
           u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
  if (!ok) return;
  // jaringan dulu (agar update cepat masuk), cadangan dari cache saat offline
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(r).then(function (m) { return m || (r.mode === "navigate" ? caches.match("./index.html") : Response.error()); });
  }));
});
