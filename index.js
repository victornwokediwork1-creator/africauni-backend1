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
  cors: {
    origin: "*"
  }
});

/* =========================
   STORAGE (TEMP DATABASE)
========================= */

let users = [];
let posts = [];
let waitingUser = null;
let activePairs = {};

/* =========================
   IMAGE UPLOAD CONFIG
========================= */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.json({
    app: "AfricaUni Backend",
    status: "Live 🚀"
  });
});

/* LOGIN */
app.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) return res.status(400).json({ error: "Username required" });

  let user = users.find(u => u.username === username);

  if (!user) {
    user = { id: Date.now(), username };
    users.push(user);
  }

  res.json({ success: true, user });
});

/* POSTS (TEXT + IMAGE) */
app.post("/post", upload.single("image"), (req, res) => {
  const { username, text } = req.body;

  let imageUrl = null;

  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const post = {
    id: Date.now(),
    username,
    text,
    image: imageUrl,
    createdAt: new Date()
  };

  posts.unshift(post);

  io.emit("newPost", post);

  res.json({ success: true, post });
});

app.get("/posts", (req, res) => {
  res.json(posts);
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  /* =========================
     OMEGLE STYLE MEET
  ========================= */

  socket.on("findMatch", () => {

    if (!waitingUser) {
      waitingUser = socket;
      socket.emit("status", "Waiting for student...");
    } else {
      const partner = waitingUser;
      waitingUser = null;

      activePairs[socket.id] = partner.id;
      activePairs[partner.id] = socket.id;

      socket.emit("matched");
      partner.emit("matched");
    }
  });

  socket.on("message", (data) => {
    const partnerId = activePairs[socket.id];

    if (partnerId) {
      io.to(partnerId).emit("message", {
        from: socket.id,
        text: data.text
      });
    }
  });

  /* =========================
     WHATSAPP CHAT SYSTEM
  ========================= */

  socket.on("joinChat", (roomId) => {
    socket.join(roomId);
  });

  socket.on("sendMessage", ({ roomId, message, user }) => {
    io.to(roomId).emit("newMessage", {
      user,
      message
    });
  });

  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", () => {

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    const partnerId = activePairs[socket.id];

    if (partnerId) {
      io.to(partnerId).emit("partnerLeft");
      delete activePairs[partnerId];
    }

    delete activePairs[socket.id];

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
