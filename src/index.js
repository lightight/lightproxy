import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
// FIX 1: Use the modern Wisp server
import { server as wisp } from "@mercuryworkshop/wisp-js/server"; 
import fetch from "node-fetch";
import ytSearch from "yt-search";
import fs from "node:fs";
import YTDlpWrap from 'yt-dlp-wrap';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicPath = join(__dirname, "../public");
const musicPublicPath = join(__dirname, "../music/public");
const profilesPublicPath = join(__dirname, "../profiles/public");

// Paths
const scramjetPath = join(__dirname, "../node_modules/@mercuryworkshop/scramjet/dist");
const uvPath = join(__dirname, "../node_modules/@titaniumnetwork-dev/ultraviolet/dist");
const epoxyPath = join(__dirname, "../node_modules/@mercuryworkshop/epoxy-transport/dist");
const baremuxPath = join(__dirname, "../node_modules/@mercuryworkshop/bare-mux/dist");

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = join(__dirname, binaryName);

import profilesPlugin from "../profiles/server.js";

// FIX 2: Configure Wisp
wisp.options.allow_udp_streams = false; // Disable UDP to prevent stability issues
wisp.options.dns_servers = ["1.1.1.1", "8.8.8.8"]; // Reliable DNS

const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        if (req.url?.endsWith("/wisp/")) {
          // FIX 3: Use the correct routeRequest method
          wisp.routeRequest(req, socket, head);
        }
      });
  },
});

// --- ENGINE SETUP ---
let ytDlpWrap;
(async () => {
    try {
        if (!fs.existsSync(binaryPath)) {
            console.log("[Engine] Downloading binary...");
            await YTDlpWrap.default.downloadFromGithub(binaryPath);
            if (process.platform !== 'win32') fs.chmodSync(binaryPath, '755');
        }
        ytDlpWrap = new YTDlpWrap.default(binaryPath);
        console.log("[Engine] Ready.");
    } catch (e) {
        console.error("[Engine] Error:", e);
    }
})();

// --- API ROUTES ---
fastify.get("/music/search", async (req, reply) => {
  const q = req.query.q;
  if (!q) return reply.status(400).send({ error: "Query required" });
  try {
    const result = await ytSearch(q);
    if (result && result.videos.length > 0) return reply.send({ videoId: result.videos[0].videoId });
    return reply.status(404).send({ error: "No results" });
  } catch (e) {
    return reply.status(500).send({ error: "Search failed" });
  }
});

fastify.get("/music/meta", async (req, reply) => {
    const { q } = req.query;
    if(!q) return reply.status(400).send({error: "Missing query"});
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`);
        return reply.send(await res.json());
    } catch(e) {
        return reply.status(500).send({error: "Meta failed"});
    }
});

fastify.get("/music/stream", async (req, reply) => {
  const { id } = req.query;
  if (!id || !ytDlpWrap) return reply.status(400).send({ error: "Unavailable" });
  try {
    reply.header('Content-Type', 'audio/mpeg');
    return reply.send(ytDlpWrap.execStream([`https://www.youtube.com/watch?v=${id}`, '-f', 'bestaudio', '-o', '-']));
  } catch (e) {
    return reply.status(500).send({ error: "Stream failed" });
  }
});

fastify.get("/music/cover", async (req, reply) => {
  const { url } = req.query;
  if(!url) return reply.status(400).send("Missing url");
  try {
      const resp = await fetch(url);
      const buffer = await resp.arrayBuffer();
      reply.header("Content-Type", resp.headers.get("content-type"));
      reply.header("Cache-Control", "public, max-age=86400");
      return reply.send(Buffer.from(buffer));
  } catch (e) { return reply.status(500).send("Error"); }
});

// --- STATIC FILES ---
// HELPER: Allows Service Workers to control the whole domain
const swHeader = (res, path) => {
    if (path.endsWith("sw.js") || path.endsWith("worker.js")) {
        res.setHeader("Service-Worker-Allowed", "/");
    }
};

fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scramjet/", decorateReply: false, setHeaders: swHeader });
fastify.register(fastifyStatic, { root: uvPath, prefix: "/uv/", decorateReply: false, setHeaders: swHeader });
fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });
fastify.register(profilesPlugin, { prefix: "/profiles" });
fastify.register(fastifyStatic, { root: musicPublicPath, prefix: "/music/", decorateReply: false });
fastify.register(fastifyStatic, { root: publicPath, prefix: "/", decorateReply: false, setHeaders: swHeader });

fastify.setNotFoundHandler((req, reply) => {
  if (req.raw.url.startsWith("/music") && !req.raw.url.includes(".")) return reply.sendFile("index.html", musicPublicPath);
  if (req.raw.url.startsWith("/profiles") && !req.raw.url.includes(".")) return reply.sendFile("index.html", profilesPublicPath);
  reply.code(404).sendFile("404.html", publicPath);
});

const port = Number(process.env.PORT || "1100") || 1100;
fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Server running on http://localhost:${port}`);
});