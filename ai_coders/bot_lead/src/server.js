// ai_coders/bot_lead/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createClient } from 'redis';
import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { initTaskManager } from './taskManager.js';
import { generateFile } from '../bot_backend/src/fileGenerator.js'; // Corrected to 2 dots

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
    console.log('Connected to Redis');
    await log('Connected to Redis');
  } catch (err) {
    await error(`Failed to connect to Redis: ${err.message}`);
    process.exit(1);
  }
})();

app.get('/health', async (req, res) => {
  await log('Healthcheck requested');
  res.status(200).send(`${BOT_NAME} is healthy!`);
});

app.post('/api/file', async (req, res) => {
  try {
    const { command, args } = req.body;
    const filePath = await generateFile(command, args); // Returns a string (file path)
    res.json({ filePath }); // Wrap in JSON object
  } catch (err) {
    await error(`Error generating file: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

initTaskManager(botSocket);

async function startServer() {
  try {
    await log(`Starting ${BOT_NAME} server...`);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    console.log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
    await log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
    setInterval(async () => await log(`${BOT_NAME} is still alive`), 30000);
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