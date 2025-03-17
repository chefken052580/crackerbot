// ai_coders/bot_backend/src/server.js
import express from 'express';
import cors from 'cors';
import http from 'http';
import { botSocket } from './socket.js';
import { initializeTaskExecution } from './taskExecution.js';
import { log, error } from './logger.js';

const BOT_NAME = "bot_backend";
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ["https://visually-sterling-spider.ngrok-free.app"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json());

app.get('/health', async (req, res) => {
  await log('Healthcheck requested');
  res.status(200).send('bot_backend is healthy!');
});

// Initialize task execution (handles all WebSocket events)
initializeTaskExecution();

setInterval(async () => {
  if (botSocket.connected) {
    await log(`${BOT_NAME} WebSocket heartbeat: still connected`);
  } else {
    await error(`${BOT_NAME} WebSocket heartbeat: disconnected`);
  }
}, 10000);

server.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] bot_backend server running on port ${PORT}`);
  await log(`bot_backend server running on port ${PORT}`);
  await log('server.js version 2025-03-17-1 loaded');
});