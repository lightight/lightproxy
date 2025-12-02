// scramjet/sw.js

// 1. Load the engine (Make sure this file exists in your folder!)
// If you have 'scramjet.codecs.js', change this line to point to that.
importScripts('/scramjet/scramjet.codecs.js'); 
// OR if you found scramjet.all.js: importScripts('/scramjet/scramjet.all.js');

// 2. Load the config we just made
importScripts('/scramjet/config.js');

// 3. Initialize
// Note: Depending on your version, this might be $scramjet or self.Scramjet
const sj = new ScramjetServiceWorker(self.__scramjet$config);

self.addEventListener('fetch', (event) => {
    if (sj.route(event)) {
        event.respondWith(sj.fetch(event));
    }
    // If not a scramjet request, let it pass through (or let UV handle it if scopes overlap)
});