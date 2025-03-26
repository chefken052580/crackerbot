// ai_coders/bot_backend/src/server.js
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { botSocket } from './socket.js';
import { initializeTaskExecution } from './taskExecution.js';
import { log, error } from './logger.js';
import { generatePdf, generateImage } from './fileGenerator.js';
import path from 'path';

const BOT_NAME = 'bot_backend';
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Log startup immediately
console.log(`[${new Date().toISOString()}] ${BOT_NAME} server.js loaded`);
log(`${BOT_NAME} server.js starting up`);

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://visually-sterling-spider.ngrok-free.app'];
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

app.post('/api/generate-file', async (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) throw new Error('Missing command in request body');

    const text = typeof args === 'string' ? args : args?.text;
    if (!text) throw new Error('Missing text in args');
    const outputFile = args?.outputFile || path.join('/tmp', `${Date.now()}-${command}.file`);

    let filePath;
    switch (command.toLowerCase()) {
      case 'pdf':
        filePath = await generatePdf(text, outputFile);
        break;
      case 'image':
        filePath = await generateImage(text, outputFile);
        break;
      default:
        throw new Error(`Unsupported command: ${command}. Use 'pdf' or 'image'`);
    }

    await log(`Generated ${command} file at ${filePath}`);
    res.json({ filePath });
  } catch (err) {
    await error(`File generation failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Initialize task execution
try {
  initializeTaskExecution();
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} task execution initialized`);
  log(`${BOT_NAME} task execution initialized`);
} catch (err) {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} task execution failed: ${err.message}`);
  error(`${BOT_NAME} task execution failed: ${err.message}`);
}

setInterval(async () => {
  if (botSocket.connected) {
    await log(`${BOT_NAME} WebSocket heartbeat: still connected`);
  } else {
    await error(`${BOT_NAME} WebSocket heartbeat: disconnected`);
  }
}, 10000);

server.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} server running on port ${PORT}`);
  await log(`${BOT_NAME} server running on port ${PORT}`);
  await log('server.js version 2025-03-25-3 loaded'); // Updated version
});

// Handle startup errors
process.on('uncaughtException', async (err) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} Uncaught exception: ${err.message}`);
  await error(`Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} Unhandled rejection at ${promise}: ${reason}`);
  await error(`Unhandled rejection at ${promise}: ${reason}`);
});