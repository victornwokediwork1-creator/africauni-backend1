const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

/* =========================
   SIMPLE MEMORY DATABASE
========================= */

let users = [];
let posts = [];

let waitingUser = null;
let activePairs = {};

/* =========================
   HOME ROUTE
========================= */

app.get("/", (req, res) => {
  res.json({
    app: "AfricaUni Backend",
    status: "Running",
    users: users.length,
    posts: posts.length
  });
});

/* =========================
   LOGIN
========================= */

app.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username required"
    });
  }

  let user = users.find(
    u => u.username === username
  );

  if (!user) {
    user = {
      id: Date.now(),
      username
    };

    users.push(user);
  }

  res.json({
    success: true,
    user
  });
});

/* =========================
   POSTS
========================= */

app.get("/posts", (req, res) => {
  res.json(posts);
});

app.post("/post", (req, res) => {
  const { username, text } = req.body;

  if (!username || !text) {
    return res.status(400).json({
      success: false,
      message: "Missing username or text"
    });
  }

  const post = {
    id: Date.now(),
    username,
    text,
    createdAt: new Date()
  };

  posts.unshift(post);

  io.emit("newPost", post);

  res.json({
    success: true,
    post
  });
});

/* =========================
   MEET SYSTEM
========================= */

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  socket.on("findMatch", () => {

    if (!waitingUser) {

      waitingUser = socket;

      socket.emit(
        "status",
        "Waiting for another student..."
      );

    } else {

      const partner = waitingUser;

      waitingUser = null;

      activePairs[socket.id] =
        partner.id;

      activePairs[partner.id] =
        socket.id;

      socket.emit(
        "matched",
        partner.id
      );

      partner.emit(
        "matched",
        socket.id
      );
    }
  });

  socket.on("message", data => {

    const partnerId =
      activePairs[socket.id];

    if (partnerId) {

      io.to(partnerId).emit(
        "message",
        {
          from: socket.id,
          text: data.text
        }
      );
    }
  });

  socket.on("disconnect", () => {

    if (
      waitingUser &&
      waitingUser.id === socket.id
    ) {
      waitingUser = null;
    }

    const partnerId =
      activePairs[socket.id];

    if (partnerId) {

      io.to(partnerId).emit(
        "partnerLeft"
      );

      delete activePairs[partnerId];
    }

    delete activePairs[socket.id];

    console.log(
      "Disconnected:",
      socket.id
    );
  });

});

/* =========================
   START SERVER
========================= */

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `AfricaUni running on port ${PORT}`
  );
});
