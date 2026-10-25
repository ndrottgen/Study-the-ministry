/* Offline support for Studying the Ministry.
   Pages and styles: try the network first so updates show right away, and fall back to the
   saved copy when offline or when the network is slow. Fonts: saved once, then served from the cache.
   Add any new page to CORE so it is saved on install. */
var VERSION = "stm-v1";
var FONTS = "stm-fonts";
var CORE = [
  "./",
  "index.html",
  "class-notes.html",
  "outlines.html",
  "prophecy.html",
  "lords-day.html",
  "site.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];
var FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("stm-") === 0 && k !== VERSION && k !== FONTS; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (FONT_HOSTS.indexOf(url.hostname) >= 0) e.respondWith(cacheFirst(req));
  // Everything else (such as GitHub sync) goes straight to the network.
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === "navigate" ? caches.match("index.html") : undefined);
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var done = false;
    function finish(r) { if (!done && r) { done = true; resolve(r); } }
    var slow = setTimeout(function () { fromCache(req).then(finish); }, 3500);
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      clearTimeout(slow);
      finish(res);
    }).catch(function () {
      clearTimeout(slow);
      fromCache(req).then(function (r) { finish(r || Response.error()); });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) {
        var copy = res.clone();
        caches.open(FONTS).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}
