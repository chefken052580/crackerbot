const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis"); // If you're using Redis for state management

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Redis client for state management or pub/sub across services
const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bot Frontend is running.");
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Forward messages to all clients, including other bots if they're connected here
  socket.on('message', async (data) => {
    // Check if the message is a command or regular message
    if (data.type === 'command') {
      // Forward command to bot_lead or wherever commands are processed
      io.to('bot_lead').emit('command', data); // Assuming bot_lead is in a room named 'bot_lead'
    } else {
      io.emit('message', data); // Broadcast the message to all connected clients
    }
    
    // Optionally, store or log messages in Redis for state management
    if (redisClient.isReady) {
      await redisClient.lPush('chatMessages', JSON.stringify(data));
    }
  });

  // Handle responses from bots or OpenAI
  socket.on('response', (data) => {
    io.emit('message', data); // Broadcast the response to all clients
  });

  // Join rooms for better message routing if needed
  socket.on('join', (room) => {
    socket.join(room);
    console.log('User joined room:', room);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Bot Frontend server running on http://0.0.0.0:${PORT}`);
});