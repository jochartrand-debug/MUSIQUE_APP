const CACHE_NAME = "unites-mesure-v31";

/*
  IMPORTANT (PWA) :
  - Toute ressource (CSS/JS/images/polices) qui doit être dispo hors‑ligne doit être listée ici.
  - En changeant des fichiers, incrémente CACHE_NAME pour forcer la mise à jour du cache.
*/
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./assets/accueil.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  // Polices (obligatoire pour que les @font-face fonctionnent en PWA)
  "./fonts/Inter-Regular.woff2",
  "./fonts/Inter-SemiBold.woff2",
  "./fonts/Inter-Bold.woff2",
  "./fonts/Inter-ExtraBold.woff2",
  "./fonts/Inter-Italic.woff2",
  "./fonts/STIXTwoText-Italic.ttf",

  // (Optionnel) si présents dans ton dossier fonts/
  "./fonts/BravuraText.woff2",
  "./fonts/BravuraText.woff",
  "./fonts/BravuraText.otf"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      // Nettoie les anciens caches (ex: v30)
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (e) => {
  // Cache-first simple (suffisant pour une PWA offline)
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
