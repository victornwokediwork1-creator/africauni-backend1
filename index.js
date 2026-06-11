const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const io = new Server(server, {
    cors: { origin: "*" }
});

let users = {};
let posts = [];
let messages = [];
let waitingUser = null;

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

app.get("/", (req, res) => {
    res.json({ status: "AfricaUni backend running 🚀" });
});

/* LOGIN */
app.post("/login", (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username required" });
    }

    if (!users[username]) {
        users[username] = { username };
    }

    res.json(users[username]);
});

/* POSTS */
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
    io.emit("newPost", post);

    res.json(post);
});

app.get("/posts", (req, res) => {
    res.json(posts);
});

/* CHAT HISTORY */
app.get("/messages", (req, res) => {
    res.json(messages);
});

/* SOCKET */
io.on("connection", (socket) => {

    socket.on("joinChat", (room) => {
        socket.join(room);
    });

    socket.on("sendMessage", (data) => {

        const msg = {
            user: data.user,
            message: data.message,
            room: data.room,
            time: Date.now()
        };

        messages.push(msg);

        io.to(data.room).emit("newMessage", msg);
    });

    socket.on("findMatch", () => {
        if (!waitingUser) {
            waitingUser = socket;
            socket.emit("status", "Searching...");
        } else {
            waitingUser.emit("matched");
            socket.emit("matched");
            waitingUser = null;
        }
    });

    socket.on("disconnect", () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running", PORT));

