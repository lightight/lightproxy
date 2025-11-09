import FastifyStatic from "@fastify/static";
import socketio from "@fastify/socket.io";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicPath = path.join(__dirname, "public");
const storeFile = path.join(__dirname, "data.json");

export default async function profilesPlugin(fastify, opts) {
  // Serve static SPA files for /profiles
  fastify.register(FastifyStatic, {
    root: publicPath,
    // No prefix here, it inherits /profiles from the main registration
    decorateReply: true // Needed for sendFile in the notFoundHandler below
  });

  // Register Socket.IO with Fastify, using relative path (full path will be /profiles/socket.io/)
  fastify.register(socketio, { path: "/socket.io/" });

  // Load or initialize storage
  let store = { profiles: {}, dms: {}, groups: {} };
  if (fs.existsSync(storeFile)) store = JSON.parse(fs.readFileSync(storeFile, "utf8"));

  const socketsByUser = {};

  function saveStore() {
    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
  }

  function genUniqueName() {
    let n;
    do {
      n = uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: "-", length: 2 });
    } while (store.profiles[n]);
    return n;
  }

  function ensureSockets(u) {
    if (!socketsByUser[u]) socketsByUser[u] = new Set();
  }

  function chatKey(a, b) {
    return [a, b].sort().join("|");
  }

  function getFriends(u) {
    const set = new Set();
    for (const key of Object.keys(store.dms)) {
      const [a, b] = key.split("|");
      if (a === u) set.add(b);
      if (b === u) set.add(a);
    }
    for (const gid of Object.keys(store.groups)) {
      const g = store.groups[gid];
      if (g.members.includes(u)) set.add(`group:${g.label}|${g.id}`);
    }
    return [...set];
  }

  // Setup Socket.IO after registration
  fastify.after(() => {
    const io = fastify.io;

    io.on("connection", (sock) => {
      let username = sock.handshake.auth?.username || genUniqueName();
      if (!store.profiles[username]) store.profiles[username] = { lastChange: 0, oldNames: [] };
      sock.username = username;

      ensureSockets(username);
      socketsByUser[username].add(sock);

      sock.emit("init", {
        username,
        friends: getFriends(username),
        groups: Object.values(store.groups).filter((g) => g.members.includes(username)),
      });

      sock.on("sendDM", ({ target, text }) => {
        if (!target || !text || !store.profiles[target]) return;
        const key = chatKey(sock.username, target);
        if (!store.dms[key]) store.dms[key] = [];
        const entry = { from: sock.username, text, time: Date.now() };
        store.dms[key].push(entry);
        saveStore();

        for (const s of socketsByUser[sock.username] || []) s.emit("dm", { key, entry });
        for (const s of socketsByUser[target] || []) {
          s.emit("dm", { key, entry });
          s.emit("addFriend", { friend: sock.username });
        }
        for (const s of socketsByUser[sock.username] || []) s.emit("addFriend", { friend: target });
      });

      sock.on("getDM", ({ target }) => {
        const key = chatKey(sock.username, target);
        sock.emit("dmHistory", { key, history: store.dms[key] || [] });
      });

      sock.on("createGroup", ({ label, members }) => {
        label = (label || "").trim();
        if (!label) return sock.emit("system", { msg: "Label required" });
        if (!members.includes(sock.username)) members.push(sock.username);
        for (const m of members) if (!store.profiles[m]) return sock.emit("system", { msg: `No such user ${m}` });
        const id = uuidv4();
        store.groups[id] = { id, label, members, messages: [] };
        saveStore();
        for (const m of members) for (const s of socketsByUser[m] || []) s.emit("groupCreated", store.groups[id]);
      });

      sock.on("sendGroup", ({ groupId, text }) => {
        const g = store.groups[groupId];
        if (!g || !g.members.includes(sock.username)) return;
        const entry = { from: sock.username, text, time: Date.now() };
        g.messages.push(entry);
        saveStore();
        for (const m of g.members) for (const s of socketsByUser[m] || []) s.emit("groupMsg", { groupId, entry });
      });

      sock.on("getGroup", ({ groupId }) => {
        const g = store.groups[groupId];
        if (!g) return;
        sock.emit("groupHistory", { groupId, history: g.messages });
      });

      sock.on("disconnect", () => {
        const u = sock.username;
        socketsByUser[u]?.delete(sock);
        if (socketsByUser[u]?.size === 0) delete socketsByUser[u];
      });
    });
  });

  // SPA fallback for /profiles/* - Ensure sendFile works
  fastify.setNotFoundHandler((req, reply) => {
     // Check if sendFile exists (it should due to decorateReply: true)
     if (reply.sendFile) {
        return reply.sendFile("index.html");
     } else {
         console.error("reply.sendFile is not available for profiles 404 handler.");
         return reply.code(404).type("text/plain").send("Not Found (Profile SPA Handler Error)");
     }
  });
}