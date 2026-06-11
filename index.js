const express = require("express");
const http = require("http");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

let posts = [];
let chats = {};

/* FILE UPLOAD */
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

/* ---------------- POSTS ---------------- */
app.get("/posts", (req, res) => {
  res.json(posts);
});

app.post("/post", upload.single("image"), (req, res) => {
  const post = {
    id: Date.now(),
    text: req.body.text,
    image: req.file ? "/uploads/" + req.file.filename : null,
    time: Date.now()
  };

  posts.unshift(post);
  res.json(post);
});

/* ---------------- CHAT ---------------- */
io.on("connection", (socket) => {
  socket.on("join", (room) => {
    socket.join(room);

    if (!chats[room]) chats[room] = [];
    socket.emit("history", chats[room]);
  });

  socket.on("msg", ({ room, msg }) => {
    const data = { msg, time: Date.now() };

    if (!chats[room]) chats[room] = [];
    chats[room].push(data);

    io.to(room).emit("new", data);
  });
});

server.listen(3000, () => console.log("AfricaUni running on port 3000"));
