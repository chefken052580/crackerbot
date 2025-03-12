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
    origin: [
      "https://visually-sterling-spider.ngrok-free.app",
      "http://localhost:*",
      "http://bot_frontend:80",
      "ws://websocket_server:5002",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get('/health', (req, res) => {
  res.status(200).send('WebSocket server is healthy');
});

io.on('connection', (socket) => {
  console.log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

  socket.on('register', (data) => {
    try {
      if (!data || !data.name || !data.role) {
        console.error(`❌ Registration failed for ${socket.id}: Missing name or role`, data);
        socket.emit('error', { message: 'Missing name or role' });
        return;
      }
      console.log(`✅ ${data.name} (${data.role}) registered with ID ${socket.id}`);
      socket.role = data.role;
      socket.frontendId = data.frontendId;
      if (data.role === 'frontend') {
        socket.join(data.frontendId);
        io.emit('frontend_connected', { 
          frontendId: socket.id, 
          ip: socket.handshake.address, 
          userName: data.name || 'Guest' 
        });
        console.log(`📤 Emitted frontend_connected for ${data.name}`);
      } else if (data.role === 'lead') {
        socket.join('bot_lead');
      }
    } catch (error) {
      console.error(`❌ Error in register for ${socket.id}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('frontend_connected', (data) => {
    console.log(`📤 Frontend connected: ID ${data.frontendId}, User: ${data.userName}, IP: ${data.ip}`);
  });

  socket.on('message', (data) => {
    console.log(`📩 Message from ${socket.id}:`, data);
    if (data.target === 'bot_lead') {
      io.to('bot_lead').emit('message', data);
    } else if (socket.role === 'lead') {
      io.to(data.frontendId).emit('message', data);
    } else if (socket.role === 'backend') {
      io.to('bot_lead').emit('message', data);
    } else {
      io.emit('message', { ...data, from: socket.role === 'frontend' ? data.user : 'Server' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ID ${socket.id}, Reason: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ HTTP and WebSocket server running on port ${PORT}`);
});