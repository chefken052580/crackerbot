// ai_coders/bot_lead/src/server.js (ESM, v2025-03-26-6)
/**
 * Lead Bot Server Module
 * Launches bot_lead’s cosmic command center with Express, Redis, and WebSocket flair.
 * Orchestrates CrackerBot’s interstellar operations with resilience and style.
 * 
 * @version 2025-03-26-6
 * @author CrackerBot Team, enhanced by xAI
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createClient } from 'redis';
import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { initTaskManager } from './taskManager.js';

const app = express();
const server = createServer(app);

const BOT_NAME = 'bot_lead';
const PORT = process.env.PORT || 5001;

app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'https://visually-sterling-spider.ngrok-free.app', 
  methods: ['GET', 'POST'],
  credentials: true 
}));
app.use(express.json());

const redisClient = createClient({ url: 'redis://redis:6379' });

redisClient.on('error', async (err) => {
  await error(`Redis Client Error: ${err.message}—holding the cosmic line!`);
});

// Initialize Redis with stellar precision
async function initRedis() {
  try {
    await log('Bot Lead powering up—linking to Redis vault...');
    await redisClient.connect();
    console.log('Connected to Redis');
    await log('Redis vault synced—data streams blazing!');
  } catch (err) {
    await error(`Redis sync failed: ${err.message}—aborting mission!`);
    process.exit(1);
  }
}

// Health check with galactic swagger
app.get('/health', async (req, res) => {
  await log('Healthcheck ping—bot_lead reporting live!');
  res.status(200).send(`${BOT_NAME} is healthy and radiating cosmic vibes!`);
});

// File generation with interstellar routing
app.post('/api/file', async (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) throw new Error('No command signal—beam me "pdf" or "image"!');
    const response = await fetch('http://bot_backend:5000/api/generate-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args: args || '' }),
    });
    if (!response.ok) throw new Error(`bot_backend misfired with ${response.status}`);
    const { filePath } = await response.json();
    await log(`File forged at ${filePath} via bot_backend—cosmic payload delivered!`);
    res.json({ filePath });
  } catch (err) {
    await error(`File generation warped out: ${err.message}—retry advised!`);
    res.status(500).json({ error: err.message });
  }
});

// Launch server with cosmic thrust
async function startServer() {
  try {
    await initRedis();
    await log(`Igniting ${BOT_NAME} server engines—warp speed ahead!`);
    await initTaskManager(botSocket);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    console.log(`${BOT_NAME} server blasting off on http://0.0.0.0:${PORT}`);
    await log(`${BOT_NAME} server live on http://0.0.0.0:${PORT}—command center at full power!`);
    setInterval(async () => await log(`${BOT_NAME} heartbeat: pulsing across the cosmos!`), 30000);
  } catch (err) {
    await error(`Server launch crashed: ${err.message}—ejecting crew!`);
    process.exit(1);
  }
}

// Cosmic error shields
process.on('uncaughtException', async (err) => {
  await error(`Uncaught Exception in ${BOT_NAME}: ${err.stack}—shields up!`);
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', async (reason) => {
  await error(`Unhandled Rejection in ${BOT_NAME}: ${reason}—keeping the faith!`);
  console.error('Unhandled Rejection:', reason);
});

// Fire up the galactic core
startServer();

export { redisClient, server, botSocket };