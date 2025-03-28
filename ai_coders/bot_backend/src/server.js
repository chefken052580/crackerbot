// ai_coders/bot_backend/src/server.js
// Version: v2025-03-28-15
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { botSocket, emit } from './socket.js';
import { initializeTaskExecution } from './taskExecution.js';
import { log, error } from './logger.js';
import { generatePdf, generateImage } from './fileGenerator.js';
import path from 'path';
import rateLimit from 'express-rate-limit';

const BOT_NAME = 'bot_backend';
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Log startup with flair
console.log(`[${new Date().toISOString()}] ${BOT_NAME} server.js v2025-03-28-15 igniting...`);
await log(`🌌 ${BOT_NAME} server.js powering up with cosmic energy!`, 'INFO');

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://visually-sterling-spider.ngrok-free.app'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const msg = `CORS rejected origin: ${origin}`;
      error(msg);
      callback(new Error(msg));
    }
  },
}));
app.use(express.json());

// Rate limiting for API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});
app.use('/api', limiter);

app.get('/health', async (req, res) => {
  await log('🌡️ Healthcheck pinged—cosmic systems nominal!', 'INFO');
  res.status(200).send(`${BOT_NAME} is pulsing with cosmic vitality!`);
});

app.post('/api/generate-file', async (req, res) => {
  const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique ID for this request
  const frontendId = req.headers['x-frontend-id'] || 'unknown'; // Optional frontend ID
  const ip = req.ip;

  try {
    const { command, args } = req.body;
    if (!command) throw new Error('Missing command in request body');

    const text = typeof args === 'string' ? args : args?.text;
    if (!text) throw new Error('Missing text in args');
    const outputFile = args?.outputFile || path.join('/tmp', `${taskId}-${command}.file`);

    await sendProgress(taskId, 10, 'Igniting file generation...', frontendId, ip);

    let filePath;
    switch (command.toLowerCase()) {
      case 'pdf':
        filePath = await generatePdf(text, outputFile, { taskId, frontendId, ip });
        break;
      case 'image':
        filePath = await generateImage(text, outputFile, 'png', { taskId, frontendId, ip });
        break;
      default:
        throw new Error(`Unsupported command: ${command}. Use 'pdf' or 'image'`);
    }

    await sendProgress(taskId, 90, `File ${command} forged at ${filePath}!`, frontendId, ip);
    await log(`🌠 Generated ${command} file at ${filePath}`, 'INFO');
    res.json({ filePath, taskId });
  } catch (err) {
    await error(`File generation failed for task "${taskId}": ${err.message}`);
    res.status(500).json({ error: err.message, taskId });
  }
});

// Initialize task execution
try {
  initializeTaskExecution();
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} task execution launched`);
  await log(`🚀 ${BOT_NAME} task execution engines fired up!`, 'INFO');
} catch (err) {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} task execution crashed: ${err.message}`);
  await error(`${BOT_NAME} task execution failed: ${err.message}`);
}

// Heartbeat check
setInterval(async () => {
  if (botSocket.connected) {
    await log(`${BOT_NAME} WebSocket heartbeat: radiating cosmic energy!`, 'INFO');
  } else {
    await error(`${BOT_NAME} WebSocket heartbeat: lost in the void`);
  }
}, 10000);

server.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} server orbiting on port ${PORT}`);
  await log(`🌍 ${BOT_NAME} server orbiting at port ${PORT}—cosmic hub online!`, 'INFO');
});

// Graceful shutdown
async function shutdown() {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} initiating cosmic shutdown...`);
  await log(`🌠 ${BOT_NAME} powering down—cleaning up cosmic debris`, 'INFO');
  server.close();
  botSocket.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', async (err) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} Cosmic anomaly detected: ${err.message}`);
  await error(`Uncaught exception: ${err.message}`);
  await shutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} Cosmic rift at ${promise}: ${reason}`);
  await error(`Unhandled rejection at ${promise}: ${reason}`);
  await shutdown();
});

/**
 * Sends progress update via WebSocket.
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip) {
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    messageId: `${taskId}-progress-${percentage}`,
  };
  try {
    emit('message', progressMessage);
    await log(`Progress ${percentage}% for "${taskId}": ${message}`, 'INFO', { taskId, frontendId, ip });
  } catch (err) {
    await error(`Progress send failed for "${taskId}": ${err.message}`);
  }
}