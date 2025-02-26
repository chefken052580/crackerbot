import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import ioClient from 'socket.io-client';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://visually-sterling-spider.ngrok-free.app", // Match frontend origin
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;
const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app"; // External tunnel

app.use(cors({
  origin: "https://visually-sterling-spider.ngrok-free.app",
  methods: ["GET", "POST"]
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('Bot Lead is healthy!');
});

// Connect bot_lead to the WebSocket server
const botSocket = ioClient(WEBSOCKET_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

botSocket.on('connect', () => {
  console.log('Bot Lead connected to WebSocket!');
  botSocket.emit('register', { name: "bot_lead", role: "lead" });
});

botSocket.on('command', async (data) => {
  console.log(`Command received by Bot Lead:`, data);
  try {
    const response = await processCommand(data.command, data.user);
    botSocket.emit('response', { success: true, response, target: 'frontend' });
  } catch (error) {
    console.error('Error processing command:', error.message);
    botSocket.emit('response', { success: false, error: error.message, target: 'frontend' });
  }
});

botSocket.on('connect_error', (error) => {
  console.error('Bot Lead WebSocket connection error:', error.message);
});

botSocket.on('disconnect', (reason) => {
  console.log('Bot Lead WebSocket disconnected:', reason);
});

server.listen(PORT, () => {
  console.log(`Bot Lead server running on port ${PORT}`);
});

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Current working directory:', process.cwd());
console.log('Attempting to load script from:', __dirname);

async function processCommand(command, user) {
  switch(command) {
    case '/list_bot_health':
      return "All bots are healthy.";
    case '/show_bot_tasks':
      return "Bot tasks: Task1, Task2.";
    case '/start_task':
      return `Task started by ${user}.`;
    case '/stop_bots':
      return "All bots stopped.";
    case '/list_projects':
      return "Projects: Project A, Project B.";
    default:
      if(command.startsWith('/')) {
        return "Unknown command: " + command;
      }
      throw new Error("Command must start with '/'");
  }
}