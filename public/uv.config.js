self.__uv$config = {
    prefix: '/uv/service/',
    
    // CHANGE THIS: Use a full URL or ensure BareMux intercepts it. 
    // For Wisp + BareMux, we generally leave this empty or point to the wisp endpoint wrapper.
    // However, the safest bet with BareMux is:
    bare: '/bare/', 
    
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv.config.js',
    sw: '/uv.worker.js',
};