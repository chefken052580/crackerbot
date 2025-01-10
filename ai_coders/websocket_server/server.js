import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

const PORT = process.env.PORT || 5002;

app.use(cors());

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('WebSocket Server is running!');
});

const clients = {};

io.on('connection', (socket) => {
  console.log(`New client connected with ID: ${socket.id}`);
  socket.on('register', ({ name, role }) => {
    if (!name || !role) {
      console.error("Invalid registration data for:", { name, role });
      return;
    }
    clients[name] = { socket, role };
    console.log(`${name} (${role}) registered successfully.`);
  });

  socket.on('message', (data) => {
    console.log(`Message received from ${socket.id}:`, data);
    
    if (data.type === 'command') {
      const { target } = data;
      if (clients[target]) {
        clients[target].socket.emit('command', data);
        console.log(`Command sent to target ${target}`);
      } else {
        console.error(`Target bot "${target}" not found.`);
      }
    } else {
      // General broadcast or specific routing can go here
      io.emit('message', data);
      console.log('Message broadcasted:', data);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client ${socket.id} disconnected with reason: ${reason}`);
    for (const [name, client] of Object.entries(clients)) {
      if (client.socket === socket) {
        delete clients[name];
        console.log(`${name} disconnected and removed.`);
        break;
      }
    }
  });
});

// Log WebSocket handshake headers for debugging
io.engine.on('initial_headers', (headers, req) => {
  console.log('WebSocket handshake headers:', headers);
});

server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});