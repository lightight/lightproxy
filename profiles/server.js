import { Server } from "socket.io";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import dotenv from 'dotenv'; 

// --- 1. SETUP PATHS & ENV ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Look 1 level up for .env
dotenv.config({ path: join(__dirname, '../.env') }); 

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- 2. DATABASE SETUP ---
const DATA_FILE = join(__dirname, "data.json");

const defaultDB = {
    users: [],              
    friendships: {},        
    dmHistory: {},          
    groups: {},             
    lastUsernameChange: {}, 
    bannedIPs: {}, 
    groupCounter: 0
};

// Initialize DB
let db = { ...defaultDB };

// Load Data Safely
if (existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
        db = { ...defaultDB, ...fileData };
        
        // Ensure arrays/objects exist (prevents crashes on corrupt data)
        if (!Array.isArray(db.users)) db.users = [];
        if (!db.friendships) db.friendships = {};
        if (!db.dmHistory) db.dmHistory = {};
        if (!db.groups) db.groups = {};
        if (!db.lastUsernameChange) db.lastUsernameChange = {};
        if (!db.bannedIPs) db.bannedIPs = {};

        console.log("[Profiles] Database loaded.");
    } catch (e) {
        console.error("[Profiles] DB Error, starting fresh.");
        db = { ...defaultDB };
    }
}

function saveData() {
    try {
        writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("[Profiles] Error saving DB:", e);
    }
}

// --- 3. HELPER: SMART IP DETECTION ---
function getIP(socket) {
    const headers = socket.handshake.headers;
    // Cloudflare
    if (headers['cf-connecting-ip']) return headers['cf-connecting-ip'];
    // Nginx / Reverse Proxy
    if (headers['x-real-ip']) return headers['x-real-ip'];
    // Forwarded For (First IP is the real one)
    if (headers['x-forwarded-for']) return headers['x-forwarded-for'].split(',')[0].trim();
    // Direct
    return socket.handshake.address;
}

// --- 4. MAIN PLUGIN ---
export default async function profilesPlugin(fastify, opts) {
  const publicDir = join(__dirname, "public");

  fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
    decorateReply: false,
  });

  const io = new Server(fastify.server, {
    path: "/profiles/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    const ip = getIP(socket);
    let username = socket.handshake.auth.username?.trim();

    // --- A. BAN CHECK ---
    if (db.bannedIPs[ip]) {
        const ban = db.bannedIPs[ip];
        if (ban.expires && Date.now() > ban.expires) {
            delete db.bannedIPs[ip];
            saveData();
        } else {
            socket.emit("forceDisconnect", { reason: ban.reason || "Banned." });
            socket.disconnect(true);
            console.log(`[Profiles] Rejected banned IP: ${ip}`);
            return;
        }
    }

    // --- B. IDENTITY LOGIC ---
    if (!username || !db.users.includes(username)) {
        if(!username) {
            username = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: "-", length: 3 });
            while (db.users.includes(username)) {
                username = `${username}-${uuidv4().slice(0, 4)}`;
            }
        }
        if(!db.users.includes(username)) {
            db.users.push(username);
            saveData();
        }
    }

    socket.join(username);
    console.log(`[Profiles] ${username} connected [${ip}]`);

    // --- C. SEND INIT DATA ---
    const myFriends = db.friendships[username] || [];
    const myGroups = Object.values(db.groups).filter(g => g.members.includes(username));
    
    socket.emit("init", { 
        username, 
        friends: myFriends, 
        groups: myGroups 
    });

    // --- D. USERNAME CHANGE LOGIC ---
    socket.on("changeUsername", ({ newName }) => {
        if (!newName || newName.length < 3 || newName.length > 20) {
            return socket.emit("system", { msg: "Name must be 3-20 characters." });
        }
        
        // Cooldown Check (24h)
        const lastChange = db.lastUsernameChange[username] || 0;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (now - lastChange < oneDay) {
            const hoursLeft = Math.ceil((oneDay - (now - lastChange)) / (60 * 60 * 1000));
            return socket.emit("system", { msg: `Cooldown active. Try again in ${hoursLeft} hours.` });
        }

        if (db.users.includes(newName)) {
            return socket.emit("system", { msg: "Username already taken." });
        }

        const oldName = username;
        console.log(`[Profiles] Renaming ${oldName} -> ${newName}`);

        // --- MIGRATION START ---
        // 1. Update User List
        const uIdx = db.users.indexOf(oldName);
        if (uIdx !== -1) db.users[uIdx] = newName;

        // 2. Update Friendships (My List)
        if (db.friendships[oldName]) {
            db.friendships[newName] = db.friendships[oldName];
            delete db.friendships[oldName];
        }
        
        // 3. Update Friendships (Others' Lists)
        for (const user in db.friendships) {
            const list = db.friendships[user];
            const fIdx = list.indexOf(oldName);
            if (fIdx !== -1) list[fIdx] = newName;
        }

        // 4. Update Groups
        for (const gid in db.groups) {
            const g = db.groups[gid];
            const mIdx = g.members.indexOf(oldName);
            if (mIdx !== -1) g.members[mIdx] = newName;
        }

        // 5. Update DM Keys (Complex)
        const newHistory = {};
        for (const key in db.dmHistory) {
            if (key.includes(oldName)) {
                const parts = key.split('|');
                if (parts.includes(oldName)) {
                    const other = parts.find(p => p !== oldName) || newName; 
                    const newKey = [newName, other].sort().join('|');
                    newHistory[newKey] = db.dmHistory[key];
                } else {
                    newHistory[key] = db.dmHistory[key];
                }
            } else {
                newHistory[key] = db.dmHistory[key];
            }
        }
        db.dmHistory = newHistory;

        // 6. Save & Cooldown
        db.lastUsernameChange[newName] = now;
        if (db.lastUsernameChange[oldName]) delete db.lastUsernameChange[oldName];
        saveData();

        // --- NOTIFICATIONS ---
        // Notify Me
        username = newName; 
        socket.leave(oldName);
        socket.join(newName);
        
        socket.emit("usernameChanged", { newName });
        socket.emit("system", { msg: "Username changed successfully!" });
        socket.emit("init", { 
            username, 
            friends: db.friendships[username] || [], 
            groups: Object.values(db.groups).filter(g => g.members.includes(username)) 
        });

        // Notify Friends
        const myFriendsList = db.friendships[username] || [];
        myFriendsList.forEach(friend => {
             io.to(friend).emit("init", {
                 username: friend,
                 friends: db.friendships[friend],
                 groups: Object.values(db.groups).filter(g => g.members.includes(friend))
             });
             io.to(friend).emit("system", { msg: `${oldName} changed name to ${newName}` });
        });

        // Notify Groups
        Object.values(db.groups).forEach(g => {
            if(g.members.includes(newName)) {
                g.members.forEach(m => {
                    if(m !== newName && !myFriendsList.includes(m)) {
                         io.to(m).emit("system", { msg: `${oldName} (group ${g.label}) changed name to ${newName}` });
                    }
                });
            }
        });
    });

    // --- E. FRIEND REQUESTS ---
    socket.on("requestFriend", ({ targetUsername }) => {
        if (!targetUsername || targetUsername === username) return;
        const friendsList = db.friendships[username] || [];
        if (friendsList.includes(targetUsername)) {
            return socket.emit("system", { msg: "You are already friends!" });
        }
        io.to(targetUsername).emit("friendRequest", { from: username });
        socket.emit("system", { msg: `Request sent to ${targetUsername}` });
    });

    socket.on("respondFriend", ({ from, accepted }) => {
        if (!from) return;
        if (accepted) {
            if (!db.friendships[username]) db.friendships[username] = [];
            if (!db.friendships[from]) db.friendships[from] = [];
            
            if(!db.friendships[username].includes(from)) db.friendships[username].push(from);
            if(!db.friendships[from].includes(username)) db.friendships[from].push(username);
            saveData();

            io.to(username).emit("init", { 
                username, friends: db.friendships[username], groups: Object.values(db.groups).filter(g => g.members.includes(username))
            });
            io.to(from).emit("init", {
                username: from, friends: db.friendships[from], groups: Object.values(db.groups).filter(g => g.members.includes(from))
            });
            io.to(from).emit("system", { msg: `${username} accepted your friend request!` });
        }
    });

    // --- F. MESSAGING (DMs & Groups) ---
    socket.on("sendDM", ({ target, text }) => {
      if (!text?.trim() || !target) return;
      const key = [username, target].sort().join("|");
      const entry = { from: username, text: text.trim(), ts: Date.now() };
      
      if (!db.dmHistory[key]) db.dmHistory[key] = [];
      db.dmHistory[key].push(entry);
      saveData();

      io.to(target).emit("dm", { key, entry });
      io.to(username).emit("dm", { key, entry });
    });

    socket.on("getDM", ({ target }) => {
      const key = [username, target].sort().join("|");
      socket.emit("dmHistory", { history: db.dmHistory[key] || [] });
    });

    socket.on("createGroup", ({ label, members = [] }) => {
      if (!label?.trim()) return socket.emit("system", { msg: "Invalid name" });
      db.groupCounter++;
      const groupId = `g${db.groupCounter}`;
      const memberSet = new Set([...members, username]);
      const group = { id: groupId, label: label.trim(), members: Array.from(memberSet), history: [] };
      db.groups[groupId] = group;
      saveData();
      
      memberSet.forEach(member => {
          io.to(member).emit("groupCreated", group);
          io.to(member).emit("system", { msg: `Added to group "${label}"` });
      });
    });

    socket.on("sendGroup", ({ groupId, text }) => {
      const group = db.groups[groupId];
      if (!group || !group.members.includes(username) || !text?.trim()) return;
      const entry = { from: username, text: text.trim(), ts: Date.now() };
      group.history.push(entry);
      saveData();
      group.members.forEach(member => io.to(member).emit("groupMsg", { groupId, entry }));
    });

    socket.on("getGroup", ({ groupId }) => {
      const group = db.groups[groupId];
      if (group && group.members.includes(username)) socket.emit("groupHistory", { history: group.history });
    });

    // --- G. ADMIN POWER TOOLS ---

    // 1. WARN
    socket.on("adminWarn", ({ password, target, message }) => {
        if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });
        io.to(target).emit("adminWarning", { message });
        socket.emit("system", { msg: `Warned ${target}` });
    });

    // 2. BAN
    socket.on("adminBan", ({ password, target, durationMinutes, reason }) => {
        if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });

        io.in(target).fetchSockets().then((sockets) => {
            if (sockets.length === 0) return socket.emit("system", { msg: "User not found or offline." });

            const targetSocket = sockets[0]; 
            const targetIP = getIP(targetSocket);

            let expires = null; 
            if (durationMinutes) expires = Date.now() + (durationMinutes * 60 * 1000);

            db.bannedIPs[targetIP] = { reason, expires };
            saveData();

            io.to(target).emit("forceDisconnect", { reason });
            sockets.forEach(s => s.disconnect(true));

            socket.emit("system", { msg: `Banned ${target} (${targetIP})` });
        });
    });

    // 3. UNBAN
    socket.on("adminUnban", ({ password, ip }) => {
        if (password !== ADMIN_PASSWORD) return;
        if (db.bannedIPs[ip]) {
            delete db.bannedIPs[ip];
            saveData();
            socket.emit("system", { msg: `Unbanned IP: ${ip}` });
        } else {
            socket.emit("system", { msg: "IP not found in ban list." });
        }
    });

    // 4. LIST BANS
    socket.on("adminListBans", ({ password }) => {
        if (password !== ADMIN_PASSWORD) return;
        socket.emit("system", { msg: JSON.stringify(db.bannedIPs, null, 2) });
    });

    // 5. LIST USERS
    socket.on("adminListUsers", ({ password }) => {
        if (password !== ADMIN_PASSWORD) return;
        
        const userList = [];
        const sockets = io.sockets.sockets; 
        
        sockets.forEach((s) => {
            const rooms = Array.from(s.rooms).filter(r => r !== s.id);
            const user = rooms[0] || "Guest";
            const ip = getIP(s);
            userList.push(`${user}: ${ip}`);
        });

        socket.emit("system", { msg: "Online Users:\n" + userList.join("\n") });
    });
  });
};