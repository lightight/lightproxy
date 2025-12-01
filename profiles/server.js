import { Server } from "socket.io";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import dotenv from 'dotenv'; 

// --- 1. SETUP PATHS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 2. LOAD .ENV EXPLICITLY ---
// We look 1 level up ('..') to find the .env in the main project folder
dotenv.config({ path: join(__dirname, '../.env') }); 

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const DATA_FILE = join(__dirname, "data.json");
// ... rest of your code ...

// Default DB Structure
const defaultDB = {
    users: [],              
    friendships: {},        
    dmHistory: {},          
    groups: {},             
    lastUsernameChange: {}, 
    bannedIPs: {}, // NEW: IP -> { reason, expires (timestamp or null) }
    groupCounter: 0
};

// Initialize with defaults
let db = { ...defaultDB };

// Load Data Safely
if (existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
        db = { ...defaultDB, ...fileData };
        
        // Safety checks
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

// Helper: Get IP from socket (handles proxies like Glitch/Replit/Nginx)
function getIP(socket) {
    return socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
}

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

    // --- 0. BAN CHECK ---
    if (db.bannedIPs[ip]) {
        const ban = db.bannedIPs[ip];
        
        // Check if expired
        if (ban.expires && Date.now() > ban.expires) {
            delete db.bannedIPs[ip];
            saveData();
        } else {
            // Still banned
            socket.emit("forceDisconnect", { reason: ban.reason || "Banned." });
            socket.disconnect(true);
            console.log(`[Profiles] Rejected banned IP: ${ip}`);
            return;
        }
    }

    // --- 1. Identity Logic ---
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

    // --- 2. Send Init ---
    const myFriends = db.friendships[username] || [];
    const myGroups = Object.values(db.groups).filter(g => g.members.includes(username));
    
    socket.emit("init", { 
        username, 
        friends: myFriends, 
        groups: myGroups 
    });

    // --- 3. STANDARD LOGIC (Chat, Groups, Name Change) ---
    // (Collapsed for brevity - paste your existing standard logic here if you modify it, 
    // but the handlers below are the critical ADMIN additions)
    
    // ... [PASTE YOUR EXISTING changeUsername, requestFriend, respondFriend, sendDM, sendGroup, createGroup LOGIC HERE] ...
    // NOTE: For the sake of this answer, I will assume the previous standard logic exists. 
    // I am only adding the NEW ADMIN EVENTS below.

    socket.on("changeUsername", ({ newName }) => { /* ... insert previous logic ... */ });
    socket.on("requestFriend", ({ targetUsername }) => { /* ... insert previous logic ... */ });
    socket.on("respondFriend", ({ from, accepted }) => { /* ... insert previous logic ... */ });
    socket.on("sendDM", ({ target, text }) => { /* ... insert previous logic ... */ });
    socket.on("getDM", ({ target }) => { /* ... insert previous logic ... */ });
    socket.on("createGroup", ({ label, members }) => { /* ... insert previous logic ... */ });
    socket.on("sendGroup", ({ groupId, text }) => { /* ... insert previous logic ... */ });
    socket.on("getGroup", ({ groupId }) => { /* ... insert previous logic ... */ });


    // --- 4. ADMIN POWER TOOLS ---

    // A. WARN USER
    socket.on("adminWarn", ({ password, target, message }) => {
        if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });
        
        io.to(target).emit("adminWarning", { message });
        socket.emit("system", { msg: `Warned ${target}` });
    });

    // B. BAN / TEMP BAN
    socket.on("adminBan", ({ password, target, durationMinutes, reason }) => {
        if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });

        // Find the socket for this user to get their IP
        // Since we are using rooms, we need to look up connected sockets in that room
        io.in(target).fetchSockets().then((sockets) => {
            if (sockets.length === 0) {
                return socket.emit("system", { msg: "User not found or offline." });
            }

            // Get IP of the first socket (user might have multiple tabs, but IP is same)
            const targetSocket = sockets[0]; 
            // Access handshake address from the underlying socket object
            const targetIP = targetSocket.handshake.headers['x-forwarded-for'] || targetSocket.handshake.address;

            // Calculate Expiry
            let expires = null; // null = permaban
            if (durationMinutes) {
                expires = Date.now() + (durationMinutes * 60 * 1000);
            }

            // Save to DB
            db.bannedIPs[targetIP] = { reason, expires };
            saveData();

            // Kick the user immediately
            io.to(target).emit("forceDisconnect", { reason });
            // Actually disconnect all sockets for this user
            sockets.forEach(s => s.disconnect(true));

            socket.emit("system", { msg: `Banned ${target} (${targetIP}) ${durationMinutes ? 'for ' + durationMinutes + 'm' : 'permanently'}` });
        });
    });

    // C. UNBAN IP
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

    // D. LIST BANS
    socket.on("adminListBans", ({ password }) => {
        if (password !== ADMIN_PASSWORD) return;
        socket.emit("system", { msg: JSON.stringify(db.bannedIPs, null, 2) });
    });
    // E. LIST ALL ONLINE USERS & IPs
    socket.on("adminListUsers", ({ password }) => {
        if (password !== ADMIN_PASSWORD) return;
        
        const userList = [];
        // Loop through all connected sockets to get their details
        const sockets = io.sockets.sockets; 
        
        sockets.forEach((s) => {
            // Find the username associated with this socket
            let user = "Unknown";
            // We can look it up in our usernameToSocket map or the socket data
            // Since we joined a room with the username, we can try to guess it, 
            // but the cleanest way is if we stored it in the socket object earlier:
            // (Make sure you add 's.username = username' in your connection logic if not already there, 
            // otherwise we just list the IP).
            
            // Let's rely on the rooms:
            const rooms = Array.from(s.rooms).filter(r => r !== s.id); // Filter out default room
            user = rooms[0] || "Guest";

            const ip = s.handshake.headers['x-forwarded-for'] || s.handshake.address;
            userList.push(`${user}: ${ip}`);
        });

        socket.emit("system", { msg: "Online Users:\n" + userList.join("\n") });
    });
  });
};