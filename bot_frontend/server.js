const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Redis client for state management or pub/sub across services
const redisClient = createClient({
  url: 'redis://redis:6379' // Use the service name instead of localhost
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.connect().then(() => {
  console.log('Successfully connected to Redis');
}).catch(err => {
  console.error('Failed to connect to Redis:', err);
});

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bot Frontend is running.");
});

app.get("/health", (req, res) => {
  res.status(200).send("Healthy");
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', async (data) => {
    if (data.type === 'command') {
      io.to('bot_lead').emit('command', data);
      console.log('Command sent to bot_lead:', data.command);
    } else {
      io.emit('message', data); // Broadcast regular messages
    }
    
    if (redisClient.isReady) {
      try {
        await redisClient.lPush('chatMessages', JSON.stringify(data));
      } catch (error) {
        console.error('Error saving to Redis:', error);
      }
    }
  });

  socket.on('commandResponse', (data) => {
    console.log('Command response received:', data);
    socket.emit('commandResponse', data); // Send back to the sender
  });

  socket.on('message', (data) => {
    console.log('Message response received:', data);
    io.emit('message', data); // Broadcast to everyone
  });

  socket.on('join', (room) => {
    socket.join(room);
    console.log('User joined room:', room);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 8080;  // Changed to 8080 or another port not in use by Nginx
httpServer.listen(PORT, () => {
  console.log(`Bot Frontend server running on port ${PORT}`);
});

// Import and initialize the socket client for communication with websocket_server
const socketClient = require('./socket');
socketClient.connectSocket();