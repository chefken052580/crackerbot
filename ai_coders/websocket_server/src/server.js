import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 5002;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: "https://visually-sterling-spider.ngrok-free.app",
    methods: ["GET", "POST"],
  },
});

app.get('/health', (req, res) => {
  res.status(200).send('WebSocket server is healthy');
});

io.on('connection', (socket) => {
  console.log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);
  
  socket.on('register', (data) => {
    console.log(`✅ ${data.name} (${data.role}) registered with ID ${socket.id}`);
    socket.role = data.role;
    socket.frontendId = data.frontendId;
    if (data.role === 'frontend') {
      socket.join(data.frontendId); // Create a unique room for each user
    }
  });

  socket.on('frontend_connected', (data) => {
    console.log(`📤 Frontend connected: ID ${data.frontendId}, User: ${data.userName}, IP: ${data.ip}`);
  });

  socket.on('message', (data) => {
    console.log(`📩 Message from ${socket.id}:`, data);
    if (data.target === 'bot_lead') {
      io.to('bot_lead').emit('message', data); // Forward commands to bot_lead
    } else if (socket.role === 'lead') {
      io.to(data.frontendId).emit('message', data); // bot_lead responses to user
    } else if (socket.role === 'backend') {
      io.to('bot_lead').emit('message', data); // bot_backend reports to bot_lead
    } else {
      io.emit('message', { ...data, from: socket.role === 'frontend' ? data.user : 'Server' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ID ${socket.id}, Reason: ${reason}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ HTTP and WebSocket server running on port ${PORT}`);
});