import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import ioClient from 'socket.io-client';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://visually-sterling-spider.ngrok-free.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;
const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

app.use(cors({
  origin: "https://visually-sterling-spider.ngrok-free.app",
  methods: ["GET", "POST"]
}));

app.get('/health', (req, res) => {
  res.send('Bot Lead with Grok 3 is healthy!');
});

const botSocket = ioClient(WEBSOCKET_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10, // Limit retries
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

botSocket.on('connect', () => {
  console.log('Bot Lead (Grok 3) connected to WebSocket!');
  botSocket.emit('register', { name: "bot_lead", role: "lead" });
});

botSocket.on('command', async (data) => {
  console.log(`Command received by Bot Lead:`, data);
  try {
    const response = await delegateTask(data.command, data.user);
    botSocket.emit('response', { success: true, response, target: 'frontend' });
  } catch (error) {
    console.error('Error processing command:', error.message);
    botSocket.emit('response', { success: false, error: error.message, target: 'frontend' });
  }
});

botSocket.on('message', async (data) => {
  console.log('Message received by Bot Lead:', data);
  const response = await grokThink(data.text);
  botSocket.emit('response', { success: true, response, target: 'frontend' });
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

// Simulate Grok 3 reasoning for task delegation
async function delegateTask(command, user) {
  if (command.startsWith('/build')) {
    const task = command.replace('/build ', '');
    const plan = `Bot Lead (Grok 3) planning: Build ${task}\n- Frontend: Design and implement UI components\n- Backend: Develop API endpoints and database schema`;
    botSocket.emit('command', { command: `Generate React UI for ${task}`, user, target: 'bot_frontend' });
    botSocket.emit('command', { command: `Create Node.js API for ${task}`, user, target: 'bot_backend' });
    return `${plan}\nTasks delegated to bot_frontend and bot_backend.`;
  }
  switch(command) {
    case '/list_bot_health':
      return "All bots are healthy and ready to code!";
    case '/show_bot_tasks':
      return "Current tasks: Frontend UI builds, Backend API development.";
    case '/start_task':
      return `Task delegation started by ${user}. Specify with /build <task>.`;
    case '/stop_bots':
      return "All bots paused—awaiting new instructions.";
    case '/list_projects':
      return "Projects: Under development based on your tasks.";
    default:
      if(command.startsWith('/')) {
        return "Unknown command: " + command + ". Try /build <task> to start coding.";
      }
      return await grokThink(command);
  }
}

// Simulate Grok 3 logical thinking (replace with actual xAI API call if available)
async function grokThink(input) {
  // Placeholder for Grok 3 logic—simulates software engineering reasoning
  if (input.includes('how') || input.includes('what')) {
    return `Grok 3 analyzing: ${input}\nLogically, as a lead bot, I’d break this into:\n1. Define requirements\n2. Delegate UI to bot_frontend\n3. Delegate logic to bot_backend\nWhat specifics do you need?`;
  }
  return `Grok 3 response: I’ll coordinate the team. Please provide a task like '/build login system' to proceed.`;
}

// Error handling for stability
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});