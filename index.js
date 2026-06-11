const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const io = new Server(server, {
    cors: { origin: "*" }
});

/* =========================
   MEMORY DATABASE
========================= */

let users = {};
let posts = [];

let waitingUser = null;

/* =========================
   IMAGE UPLOAD CONFIG
========================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/* =========================
   BASIC ROUTE
========================= */

app.get("/", (req, res) => {
    res.json({ message: "AfricaUni Backend Running 🚀" });
});

/* =========================
   LOGIN / PROFILE CREATE
========================= */

app.post("/login", (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username required" });
    }

    if (!users[username]) {
        users[username] = {
            username,
            followers: [],
            following: []
        };
    }

    res.json(users[username]);
});

/* =========================
   FOLLOW SYSTEM
========================= */

app.post("/follow", (req, res) => {
    const { user, target } = req.body;

    if (!users[user] || !users[target]) {
        return res.status(404).json({ error: "User not found" });
    }

    if (!users[user].following.includes(target)) {
        users[user].following.push(target);
    }

    if (!users[target].followers.includes(user)) {
        users[target].followers.push(user);
    }

    res.json({ success: true });
});

app.post("/unfollow", (req, res) => {
    const { user, target } = req.body;

    users[user].following =
        users[user].following.filter(u => u !== target);

    users[target].followers =
        users[target].followers.filter(u => u !== user);

    res.json({ success: true });
});

/* =========================
   GET PROFILE
========================= */

app.get("/profile/:username", (req, res) => {
    const user = users[req.params.username];

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
});

/* =========================
   POSTS (REAL SHARED FEED)
========================= */

app.post("/post", upload.single("image"), (req, res) => {

    const { username, text } = req.body;

    let image = null;
    if (req.file) {
        image = "/uploads/" + req.file.filename;
    }

    const post = {
        id: Date.now(),
        username,
        text,
        image
    };

    posts.unshift(post);

    // 🔥 SEND TO ALL USERS LIVE
    io.emit("newPost", post);

    res.json(post);
});

/* GET ALL POSTS */
app.get("/posts", (req, res) => {
    res.json(posts);
});

/* =========================
   SOCKET.IO SYSTEM
========================= */

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    /* JOIN USER */
    socket.on("joinUser", (username) => {
        socket.username = username;
        socket.join(username);
    });

    /* GROUP CHAT */
    socket.on("joinChat", (roomId) => {
        socket.join(roomId);
    });

    socket.on("sendMessage", ({ roomId, user, message }) => {
        io.to(roomId).emit("newMessage", { user, message });
    });

    /* PRIVATE CHAT */
    socket.on("privateMessage", ({ from, to, message }) => {

        io.to(to).emit("newMessage", {
            user: from,
            message
        });

        io.to(from).emit("newMessage", {
            user: from,
            message
        });
    });

    /* OMEGLE MATCH SYSTEM */
    socket.on("findMatch", () => {

        if (!waitingUser) {
            waitingUser = socket;
            socket.emit("status", "Searching...");
        } else {
            const partner = waitingUser;
            waitingUser = null;

            socket.emit("matched");
            partner.emit("matched");
        }
    });

    socket.on("disconnect", () => {

        if (waitingUser?.id === socket.id) {
            waitingUser = null;
        }

        console.log("User disconnected:", socket.id);
    });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("AfricaUni running on port", PORT);
});
