// bot_lead/src/server.js
// Version: v2025-07-24-05
/**
 * Bot Lead Server Module
 * Powers up CrackerBot’s lead service with cosmic swagger, managing HTTP and WebSocket connections.
 * Enhanced by xAI for robust initialization and error handling.
 *
 * @version 2025-07-24-05
 * @author CrackerBot Team, enhanced by xAI
 * @module server
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { log, error } from './logger.js';
import { initializeTaskManager } from './taskManager.js';
import { redisClientPromise } from './redisClient.js';

const app = express();
const server = createServer(app);
const BOT_NAME = 'bot_lead';
const PORT = process.env.PORT || 5001;

app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'https://f644b8286028.ngrok.app', 
  methods: ['GET', 'POST'],
  credentials: true 
}));
app.use(express.json());

// Health check with minimal dependencies
app.get('/health', (req, res) => {
  log('Healthcheck ping—bot_lead responding', { taskId: 'health' });
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
    await log(`File forged at ${filePath} via bot_backend—cosmic payload delivered!`, { taskId: 'file' });
    res.json({ filePath });
  } catch (err) {
    await error(`File generation warped out: ${err.message}—retry advised!`, { taskId: 'file' });
    res.status(500).json({ error: err.message });
  }
});

// Launch server with cosmic thrust
async function startServer() {
  try {
    await log('🌌 Igniting bot_lead server engines—warp speed ahead!', { taskId: 'init' });
    // Start server immediately to ensure health check is available
    await new Promise((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    console.log(`${BOT_NAME} server blasting off on http://0.0.0.0:${PORT}`);
    await log(`${BOT_NAME} server live on http://0.0.0.0:${PORT}—command center at full power!`, { taskId: 'init' });

    // Initialize Redis and Task Manager asynchronously
    try {
      await redisClientPromise;
      await log('Redis connection established for bot_lead', { taskId: 'init' });
      await initializeTaskManager();
      await log('Task Manager initialized for bot_lead', { taskId: 'init' });
    } catch (err) {
      await error(`Initialization of Redis or Task Manager failed: ${err.message}`, { taskId: 'init' });
      console.error('Initialization error:', err);
    }

    setInterval(async () => await log(`${BOT_NAME} heartbeat: pulsing across the cosmos!`, { taskId: 'heartbeat' }), 30000);
  } catch (err) {
    await error(`Server launch crashed: ${err.message}—ejecting crew!`, { taskId: 'init' });
    console.error('Server launch error:', err);
    process.exit(1);
  }
}

// Cosmic error shields
process.on('uncaughtException', async (err) => {
  await error(`Uncaught Exception in ${BOT_NAME}: ${err.stack}—shields up!`, { taskId: 'error' });
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', async (reason) => {
  await error(`Unhandled Rejection in ${BOT_NAME}: ${reason}—keeping the faith!`, { taskId: 'error' });
  console.error('Unhandled Rejection:', reason);
});

// Fire up the galactic core
startServer();

export { server };