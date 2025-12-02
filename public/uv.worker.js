importScripts('/baremux/index.js');
importScripts('/epoxy/index.js');
importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// Setup Wisp
(async () => {
    try {
        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
        await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    } catch(e) { console.error("UV Transport Error", e); }
})();

self.addEventListener('fetch', event => {
    if (event.request.url.startsWith(location.origin + self.__uv$config.prefix)) {
        event.respondWith(uv.fetch(event));
    }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));