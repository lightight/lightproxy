import { Server } from "socket.io";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";

// In-memory storage
const clients = new Map();
const usernameToSocket = new Map();
const dmHistory = new Map();
const groups = new Map();
let groupCounter = 0;

// --- ADMIN CONFIGURATION ---
const ADMIN_PASSWORD = "void-admin-secret"; 

export default async function profilesPlugin(fastify, opts) {
  // Socket.IO setup
  const io = new Server(fastify.server, {
    path: "/profiles/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Serve static files (like admin.html)
  const publicDir = join(new URL(".", import.meta.url).pathname, "public");

  // Registers static files at /profiles/
  // e.g. /profiles/public/admin.html -> /profiles/admin.html
  fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: "/", 
    decorateReply: false,
  });

  // Socket Logic
  io.on("connection", (socket) => {
    let username = socket.handshake.auth.username?.trim();

    // Generate name if missing
    if (!username) {
      username = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: "-",
        length: 3,
      });
    }

    // Handle duplicates
    while (usernameToSocket.has(username)) {
      username = `${username}-${uuidv4().slice(0, 4)}`;
    }

    // Store connection
    clients.set(socket.id, { username, socket });
    usernameToSocket.set(username, socket.id);
    console.log(`[Profiles] ${username} connected`);

    // Init
    socket.emit("init", { username, friends: [], groups: [] });

    // --- DM Handling ---
    socket.on("sendDM", ({ target, text }) => {
      if (!text?.trim() || !target) return;
      
      // Create consistent key (alphabetical)
      const key = [username, target].sort().join("|");
      const entry = { from: username, text: text.trim(), ts: Date.now() };

      if (!dmHistory.has(key)) dmHistory.set(key, []);
      dmHistory.get(key).push(entry);

      // Send to target
      const targetSid = usernameToSocket.get(target);
      if (targetSid) {
          io.to(targetSid).emit("dm", { key, entry });
      }
      
      // Send back to sender (so they see their own msg)
      socket.emit("dm", { key, entry });
    });

    socket.on("getDM", ({ target }) => {
      const key = [username, target].sort().join("|");
      socket.emit("dmHistory", { history: dmHistory.get(key) || [] });
    });

    // --- Group Handling ---
    socket.on("createGroup", ({ label, members = [] }) => {
      if (!label?.trim()) return socket.emit("system", { msg: "Invalid name" });

      const groupId = `g${++groupCounter}`;
      // Ensure creator is in group
      const memberSet = new Set([...members, username]);

      const group = { id: groupId, label: label.trim(), members: Array.from(memberSet), history: [] };
      groups.set(groupId, group);

      // Notify all members
      for (const member of memberSet) {
        const sid = usernameToSocket.get(member);
        if (sid) {
          io.to(sid).emit("groupCreated", group);
          io.to(sid).emit("system", { msg: `Added to group "${label}"` });
        }
      }
    });

    socket.on("sendGroup", ({ groupId, text }) => {
      const group = groups.get(groupId);
      // Check if group exists and user is member
      if (!group || !group.members.includes(username) || !text?.trim()) return;

      const entry = { from: username, text: text.trim(), ts: Date.now() };
      group.history.push(entry);

      // Broadcast to all members
      for (const member of group.members) {
        const sid = usernameToSocket.get(member);
        if (sid) io.to(sid).emit("groupMsg", { groupId, entry });
      }
    });

    socket.on("getGroup", ({ groupId }) => {
      const group = groups.get(groupId);
      if (group && group.members.includes(username)) {
        socket.emit("groupHistory", { history: group.history });
      }
    });

    // --- Admin Broadcast ---
    socket.on("adminBroadcast", ({ password, message }) => {
        if (password === ADMIN_PASSWORD) {
            console.log(`[Admin] Broadcast: ${message}`);
            io.emit("globalNotification", { message, from: "System" });
            socket.emit("system", { msg: "Broadcast sent." });
        } else {
            socket.emit("system", { msg: "Invalid Password" });
        }
    });

    // Disconnect
    socket.on("disconnect", () => {
      usernameToSocket.delete(username);
      clients.delete(socket.id);
    });
  });
};