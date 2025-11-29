import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Server as SocketIO } from "socket.io";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const fastify = Fastify();
const publicPath = path.join(process.cwd(), "public");

// Serve static files under /profiles
fastify.register(fastifyStatic, {
  root: publicPath,
  prefix: "/profiles/",
  decorateReply: true
});

// Data store
const storeFile = path.join(process.cwd(), "data.json");
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

function ensureSockets(u) { if (!socketsByUser[u]) socketsByUser[u] = new Set(); }
function chatKey(a,b) { return [a,b].sort().join("|"); }
function getFriends(u) {
  const set = new Set();
  for (const key of Object.keys(store.dms)) {
    const [a,b] = key.split("|");
    if (a === u) set.add(b);
    if (b === u) set.add(a);
  }
  for (const gid of Object.keys(store.groups)) {
    const g = store.groups[gid];
    if (g.members.includes(u)) set.add(`group:${g.label}|${g.id}`);
  }
  return [...set];
}

// Socket.io, also under /profiles
const io = new SocketIO(fastify.server, { path: "/profiles/socket.io" });

io.on("connection", (sock) => {
  let username = sock.handshake.auth?.username || genUniqueName();
  if (!store.profiles[username]) store.profiles[username] = { lastChange: 0, oldNames: [] };
  sock.username = username;

  ensureSockets(username);
  socketsByUser[username].add(sock);

  sock.emit("init", {
    username,
    friends: getFriends(username),
    groups: Object.values(store.groups).filter(g => g.members.includes(username))
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
    label = (label||"").trim();
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
    if (socketsByUser[u]?.size===0) delete socketsByUser[u];
  });
});

// Start server
const PORT = parseInt(process.env.PORT || "1100");
fastify.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`Profiles server running at http://localhost:${PORT}/profiles`);
});
