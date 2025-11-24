// music/server.js
import Fastify from "fastify";
import cors from "cors";
import fetch from "node-fetch";

const fastify = Fastify();
fastify.register(require("@fastify/cors"), { origin: "*" });

// YouTube search proxy
fastify.get("/search", async (req, reply) => {
  const q = req.query.q;
  if (!q) return reply.status(400).send({ error: "Query required" });

  try {
    const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
    const html = await ytRes.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    reply.send({ videoId: match ? match[1] : null });
  } catch (e) {
    console.error(e);
    reply.status(500).send({ error: "Failed to search YouTube" });
  }
});

export default fastify;
