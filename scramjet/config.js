// scramjet/config.js
self.__scramjet$config = {
    prefix: '/scramjet/',
    codec: 'plain', // Uses plain text URLs for speed (or 'xor' for obfuscation)
    config: '/scramjet/config.js'
};
// Bind to global scope for the service worker
var _CONFIG = self.__scramjet$config;