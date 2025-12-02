// VOIDRelease/public/sj.worker.js

importScripts("/scramjet/scramjet.all.js");

// 1. Define your configuration explicitly
const myConfig = {
    prefix: '/scramjet/',
    // Generate the Wisp URL dynamically based on the current page's protocol
    wispUrl: (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/",
    codec: 'plain',
    files: {
        wasm: '/scramjet/scramjet.wasm.wasm',
        all: '/scramjet/scramjet.all.js'
    }
};

// 2. Initialize the Scramjet Worker
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// 3. OVERRIDE loadConfig
// This forces Scramjet to use 'myConfig' immediately, bypassing any network requests for a config file.
scramjet.loadConfig = async () => {
    scramjet.config = myConfig;
    return myConfig;
};

// 4. Pre-load the config right now
scramjet.config = myConfig;

// 5. Main Fetch Event Listener
self.addEventListener("fetch", (event) => {
    event.respondWith((async () => {
        // We don't need to call await scramjet.loadConfig() here because we set it above.
        // However, we keep it for safety in case internal logic expects the promise to settle.
        if (!scramjet.config) await scramjet.loadConfig();

        if (scramjet.route(event)) {
            return scramjet.fetch(event);
        }

        return fetch(event.request);
    })());
});