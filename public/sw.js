// Pages and APIs stay network-only. A stale worker must never replace a reachable
// local Lifemap server with its cached offline page after a server restart.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('raum-shell-')).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
