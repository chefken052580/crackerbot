import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createClient } from 'redis';
import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { initTaskManager } from './taskManager.js';
import { generateFile } from './fileGenerator.js';

const app = express();
const server = http.createServer(app);

const BOT_NAME = 'bot_lead';
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "https://visually-sterling-spider.ngrok-free.app", methods: ["GET", "POST"] }));
app.use(express.json());

const redisClient = createClient({ url: 'redis://redis:6379' });

redisClient.on('error', (err) => error(`Redis Client Error: ${err.message}`));
(async () => {
  try {
    await redisClient.connect();
    log('Connected to Redis');
  } catch (err) {
    await error(`Failed to connect to Redis: ${err.message}`);
    process.exit(1);
  }
})();

app.get('/health', (req, res) => {
  log('Healthcheck requested');
  res.status(200).send(`${BOT_NAME} is healthy!`);
});

app.post('/api/file', async (req, res) => {
  try {
    const { command, args } = req.body;
    const fileData = await generateFile(command, args);
    res.json(fileData);
  } catch (err) {
    await error(`Error generating file: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

botSocket.on('connect', () => {
  log(`${BOT_NAME} connected to WebSocket`);
  botSocket.emit('register', { name: BOT_NAME, role: 'lead', userId: botSocket.id });
  initTaskManager(botSocket);
});

botSocket.on('connect_error', (err) => error(`${BOT_NAME} WebSocket connection error: ${err.message}`));
botSocket.on('disconnect', (reason) => log(`${BOT_NAME} WebSocket disconnected: ${reason}`));

async function startServer() {
  try {
    log(`Starting ${BOT_NAME} server...`);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
    setInterval(() => log(`${BOT_NAME} is still alive`), 30000);
  } catch (err) {
    await error(`Error starting server: ${err.message}`);
    process.exit(1);
  }
}

startServer();

process.on('uncaughtException', async (err) => {
  await error(`Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  await error(`Unhandled Rejection: ${reason}`);
});