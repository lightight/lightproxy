import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";

// import your profiles plugin
import profilesPlugin from "../profiles/server.js"; // adjust path if needed

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp config
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: [/example\.com/],
  dns_servers: ["1.1.1.3", "1.0.0.3"]
});

const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        if (req.url.endsWith("/wisp/")) {
          wisp.routeRequest(req, socket, head);
        } // Removed else socket.end() to allow other upgrade handlers (e.g., Socket.IO) to process the request
      });
  },
});

// MOUNT PROFILES FIRST so /profiles serves its own index.html
fastify.register(profilesPlugin, { prefix: "/profiles" });

// main static site
fastify.register(fastifyStatic, {
  root: publicPath,
  decorateReply: true // Keep true for main site's sendFile in notFoundHandler
});

// other static folders
fastify.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
  decorateReply: false,
});

fastify.register(fastifyStatic, {
  root: epoxyPath,
  prefix: "/epoxy/",
  decorateReply: false,
});

fastify.register(fastifyStatic, {
  root: baremuxPath,
  prefix: "/baremux/",
  decorateReply: false,
});

// 404 handler for main site (but not /profiles) - CORRECTED
fastify.setNotFoundHandler((req, reply) => {
  // If the request is NOT for the /profiles prefix, serve the main 404 page.
  if (!req.raw.url.startsWith("/profiles")) {
    // Check if decorateReply is available before using sendFile
    if (reply.sendFile) { 
        return reply.code(404).type("text/html").sendFile("404.html");
    } else {
        // Fallback if sendFile isn't decorated (shouldn't happen with current setup)
        console.error("reply.sendFile is not available for main 404 handler.");
        return reply.code(404).type("text/plain").send("Not Found");
    }
  }
  
  // If the request IS for /profiles, delegate to the plugin's notFoundHandler.
  return reply.callNotFound(); 
});


// log server addresses
fastify.server.on("listening", () => {
  const address = fastify.server.address();
  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  console.log(
    `\thttp://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`
  );
});

// graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  fastify.close();
  process.exit(0);
}

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 1100;

fastify.listen({
  port: port,
  host: "0.0.0.0",
});