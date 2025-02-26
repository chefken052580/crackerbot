import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: 'https://visually-sterling-spider.ngrok-free.app',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));

app.get('/', (req, res) => {
  res.send('WebSocket Server is running!');
});

const io = new Server(server, {
  cors: corsOptions,
  pingInterval: 10000, // Faster pings to detect issues
  pingTimeout: 5000,
});

const PORT = process.env.PORT || 5002;
const clients = {};

io.on('connection', (socket) => {
  console.log(`New client connected with ID: ${socket.id}, IP: ${socket.handshake.address}`);
  socket.on('register', ({ name, role }) => {
    if (!name || !role) {
      console.error("Invalid registration:", { name, role });
      return;
    }
    clients[name] = { socket, role };
    console.log(`${name} (${role}) registered successfully. Clients:`, Object.keys(clients));
  });

  socket.on('message', (data) => {
    console.log(`Message from ${socket.id}:`, data);
    if (data.type === 'command') {
      const { target } = data;
      if (clients[target]) {
        clients[target].socket.emit('command', data);
        console.log(`Command sent to ${target}`);
      } else {
        console.error(`Target "${target}" not found. Clients:`, Object.keys(clients));
      }
    } else {
      socket.broadcast.emit('message', data);
      console.log('Message broadcasted:', data);
    }
  });

  socket.on('response', (data) => {
    console.log(`Response from ${socket.id}:`, data);
    io.emit('commandResponse', data);
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client ${socket.id} disconnected: ${reason}`);
    for (const [name, client] of Object.entries(clients)) {
      if (client.socket === socket) {
        delete clients[name];
        console.log(`${name} removed. Remaining clients:`, Object.keys(clients));
        break;
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error from ${socket.id}:`, error.message);
  });
});

io.engine.on('initial_headers', (headers, req) => {
  console.log('Handshake headers:', headers);
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});