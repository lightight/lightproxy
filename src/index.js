import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import wisp from "wisp-server-node";
import fetch from "node-fetch";
import ytSearch from "yt-search";
import fs from "node:fs";

// 1. Import the Wrapper
import YTDlpWrap from 'yt-dlp-wrap';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicPath = join(__dirname, "../public");
const musicPublicPath = join(__dirname, "../music/public");
const profilesPublicPath = join(__dirname, "../profiles/public");

// -----------------------------
//  CROSS-PLATFORM BINARY SETUP
// -----------------------------
// Detect OS: Use 'yt-dlp.exe' for Windows, 'yt-dlp' for Linux/Mac
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = join(__dirname, binaryName);

// Import plugins
const uvPath = join(__dirname, "../node_modules/@titaniumnetwork-dev/ultraviolet/dist");
const epoxyPath = join(__dirname, "../node_modules/@mercuryworkshop/epoxy-transport/dist");
const baremuxPath = join(__dirname, "../node_modules/@mercuryworkshop/bare-mux/dist");
import profilesPlugin from "../profiles/server.js";

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
          wisp.routeRequest(req, socket, head);
        }
      });
  },
});

// -----------------------------
//  AUTO-UPDATING AUDIO ENGINE
// -----------------------------
let ytDlpWrap;

(async () => {
    try {
        console.log(`[Engine] Checking for ${binaryName} binary...`);
        if (!fs.existsSync(binaryPath)) {
            console.log("[Engine] Binary not found. Downloading latest version from GitHub...");
            await YTDlpWrap.default.downloadFromGithub(binaryPath);
            
            // LINUX/MAC FIX: Grant execute permissions after download
            if (process.platform !== 'win32') {
                console.log("[Engine] Applying executable permissions...");
                fs.chmodSync(binaryPath, '755');
            }
            
            console.log("[Engine] Download complete!");
        } else {
             console.log("[Engine] Binary found at: " + binaryPath);
        }
        
        ytDlpWrap = new YTDlpWrap.default(binaryPath);
        console.log("[Engine] Ready to stream.");
    } catch (e) {
        console.error("[Engine] Failed to initialize:", e);
    }
})();

// -----------------------------
//  API ROUTES (Must be defined BEFORE static files)
// -----------------------------

// 1. Search Route (YouTube)
fastify.get("/music/search", async (req, reply) => {
  const q = req.query.q;
  if (!q) return reply.status(400).send({ error: "Query required" });
  
  console.log(`[Music] Searching YT: ${q}`);
  try {
    const result = await ytSearch(q);
    if (result && result.videos.length > 0) {
      const video = result.videos[0];
      console.log(`[Music] Found: ${video.title} (${video.videoId})`);
      return reply.send({ videoId: video.videoId });
    }
    return reply.status(404).send({ error: "No results found" });
  } catch (e) {
    console.error("[Music] Search Error:", e);
    return reply.status(500).send({ error: "Search failed internally" });
  }
});

// 2. iTunes Metadata Proxy (Fixes Mobile Search)
fastify.get("/music/meta", async (req, reply) => {
    const { q } = req.query;
    if(!q) return reply.status(400).send({error: "Missing query"});
    
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        if (!res.ok) throw new Error(`iTunes responded with ${res.status}`);
        
        const data = await res.json();
        return reply.send(data);
    } catch(e) {
        console.error("[Music] Meta Fetch Error:", e);
        return reply.status(500).send({error: "Metadata fetch failed: " + e.message});
    }
});

// 3. Stream Route
fastify.get("/music/stream", async (req, reply) => {
  const { id } = req.query;
  if (!id) return reply.status(400).send({ error: "ID required" });

  if (!ytDlpWrap) {
      return reply.status(503).send({ error: "Engine not ready yet" });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${id}`;
  
  try {
    reply.header('Content-Type', 'audio/mpeg');
    const readableStream = ytDlpWrap.execStream([
        videoUrl,
        '-f', 'bestaudio', 
        '-o', '-' 
    ]);
    return reply.send(readableStream);
  } catch (e) {
    console.error("[Music] Stream Error:", e.message);
    return reply.status(500).send({ error: "Stream failed" });
  }
});

// 4. Cover Art Proxy
fastify.get("/music/cover", async (req, reply) => {
  const { url } = req.query;
  if(!url) return reply.status(400).send("Missing url");
  try {
      const resp = await fetch(url);
      const buffer = await resp.arrayBuffer();
      reply.header("Content-Type", resp.headers.get("content-type"));
      reply.header("Cache-Control", "public, max-age=86400");
      return reply.send(Buffer.from(buffer));
  } catch (e) {
      return reply.status(500).send("Image Fetch Error");
  }
});

// -----------------------------
//  PLUGINS & STATIC FILES
// -----------------------------

// UV, Epoxy, BareMux (Proxy Core)
fastify.register(fastifyStatic, { root: uvPath, prefix: "/uv/", decorateReply: false });
fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

// Profiles Plugin
fastify.register(profilesPlugin, { prefix: "/profiles" });

// Music App (Isolated at /music/)
fastify.register(fastifyStatic, { 
    root: musicPublicPath, 
    prefix: "/music/", 
    decorateReply: false 
});

// Main App (Served at Root /)
// This replaces the old /public/ route and the redirect
fastify.register(fastifyStatic, { 
    root: publicPath, 
    prefix: "/", 
    decorateReply: false 
});

// 404 / Fallback Handler
fastify.setNotFoundHandler((request, reply) => {
  const url = request.raw.url || "";
  
  // 1. API Errors return JSON
  if (url.startsWith("/music/search") || url.startsWith("/music/stream") || url.startsWith("/music/meta")) {
      return reply.code(404).send({ error: "API Endpoint Not Found" });
  }
  
  // 2. SPA Fallbacks
  if (url.startsWith("/music") && !url.includes(".")) {
    return reply.sendFile("index.html", musicPublicPath);
  }
  if (url.startsWith("/profiles") && !url.includes(".")) {
    return reply.sendFile("index.html", profilesPublicPath);
  }

  // 3. Main App Fallback (Optional: serve 404 page or index.html)
  // Since we are serving root static files, let's serve the custom 404 if it exists, otherwise standard 404.
  // Using sendFile requires the path to be relative to the root registered above or absolute.
  // Since we have multiple roots, it's safer to use the absolute path variable.
  reply.code(404).sendFile("404.html", publicPath);
});

const port = Number(process.env.PORT || "1100") || 1100;
fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`- Main App:  http://localhost:${port}/`);
  console.log(`- Music App: http://localhost:${port}/music/`);
  console.log(`- Profiles: http://localhost:${port}/profiles/`);
});