import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fetch from "node-fetch";
import ytSearch from "yt-search";
import fs from "node:fs";

// 1. Import the Wrapper
import YTDlpWrap from 'yt-dlp-wrap';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path where your music player HTML (index.html) is located
const musicPublicPath = join(__dirname, "../music/public");

// -----------------------------
//  CROSS-PLATFORM BINARY PATH
// -----------------------------
// Check if running on Windows or Linux/Mac
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = join(__dirname, binaryName);

const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        // Security headers for isolation
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        handler(req, res);
      });
  },
});

// Register Static Files (Serve the Music Player)
fastify.register(fastifyStatic, { 
    root: musicPublicPath, 
    prefix: "/music/", 
    decorateReply: false 
});

// Redirect root to music player
fastify.get("/", async (req, reply) => {
  return reply.redirect("/music/");
});

// -----------------------------
//  AUTO-UPDATING AUDIO ENGINE
// -----------------------------
let ytDlpWrap;

// Initialize Engine
(async () => {
    try {
        console.log(`[Engine] OS detected: ${process.platform}`);
        console.log(`[Engine] Checking for ${binaryName}...`);
        
        if (!fs.existsSync(binaryPath)) {
            console.log("[Engine] Binary not found. Downloading latest version from GitHub...");
            
            // This function automatically detects the OS and downloads the correct binary
            // We just provide the path where we want to save it
            await YTDlpWrap.default.downloadFromGithub(binaryPath);
            
            // On Linux/Mac, we must ensure the file is executable
            if (process.platform !== 'win32') {
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
//  API ROUTES
// -----------------------------

// 1. Search Route
fastify.get("/music/search", async (req, reply) => {
  const q = req.query.q;
  if (!q) return reply.status(400).send({ error: "Query required" });
  
  console.log(`[Music] Searching: ${q}`);
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

// 2. Stream Route (Powered by yt-dlp-wrap)
fastify.get("/music/stream", async (req, reply) => {
  const { id } = req.query;
  if (!id) return reply.status(400).send({ error: "ID required" });

  if (!ytDlpWrap) {
      return reply.status(503).send({ error: "Engine not ready yet" });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${id}`;
  console.log(`[Music] Stream Request for: ${id}`);

  try {
    reply.header('Content-Type', 'audio/mpeg');

    // Create a stream directly from the binary execution
    const readableStream = ytDlpWrap.execStream([
        videoUrl,
        '-f', 'bestaudio', 
        '-o', '-' 
    ]);

    // Pipe the stream to the response
    return reply.send(readableStream);

  } catch (e) {
    console.error("[Music] Stream Error:", e.message);
    return reply.status(500).send({ error: "Stream failed" });
  }
});

// 3. Cover Art Proxy
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

// 404 Handler (SPA Support)
fastify.setNotFoundHandler((request, reply) => {
  const url = request.raw.url || "";
  
  // If it's an API call that failed, return JSON error
  if (url.startsWith("/music/search") || url.startsWith("/music/stream") || url.startsWith("/music/cover")) {
      return reply.code(404).send({ error: "API Endpoint Not Found" });
  }
  
  // If user is trying to access a page under /music/ (like /music/settings), serve index.html
  if (url.startsWith("/music") && !url.includes(".")) {
    return reply.sendFile("index.html");
  }
  
  reply.code(404).send("Not Found");
});

const port = Number(process.env.PORT || "1100") || 1100;
fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Music Server running on http://localhost:${port}/music/`);
});