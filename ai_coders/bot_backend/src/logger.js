// bot_backend/src/logger.js
// Version: v2025-07-26-01
/**
 * CrackerBot’s Cosmic Log Forge
 * Captures the galaxy’s pulse with supernova precision, JSON content logging, and cosmic swagger.
 * Enhanced by xAI for detailed metadata, Redis storage, and progress emission.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module logger
 */

import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
import { createClient } from 'redis';

const logDir = process.env.LOG_DIR || './logs';
const dateStr = new Date().toISOString().split('T')[0];
const logFile = path.join(logDir, `bot_backend_${dateStr}.log`);
const maxLogSize = 10 * 1024 * 1024; // 10MB

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

let logStream = createWriteStream(logFile, { flags: 'a' });
let logSize = 0;
let logBuffer = [];
const flushInterval = 5000; // Flush every 5s
const maxBufferSize = 200; // Flush when buffer hits 200 entries

// Redis client for logging-related operations
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  password: process.env.REDIS_PASSWORD || 'crackerbot',
});

redisClient.on('error', async (err) => {
  console.error(`Redis logging error: ${err.message}`);
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Redis logging connection established');
  } catch (err) {
    console.error(`Redis logging connection failed: ${err.message}`);
  }
})();

/**
 * Rotates log file if size exceeds limit with supernova precision.
 * @returns {Promise<void>}
 */
async function rotateLog() {
  try {
    const stats = await fs.stat(logFile);
    if (stats.size + logSize >= maxLogSize) {
      logStream.end();
      const archiveFile = path.join(logDir, `bot_backend_${dateStr}_${Date.now()}.log`);
      await fs.rename(logFile, archiveFile);
      logStream = createWriteStream(logFile, { flags: 'a' });
      logSize = 0;
      console.log(`🌌 Log supernova-rotated to ${archiveFile}`); // Direct stdout for Docker
      await log(`🌌 Log supernova-rotated to ${archiveFile}`, 'INFO');
    }
  } catch (err) {
    console.error(`💥 Critical supernova error rotating log: ${err.message}`);
  }
}

/**
 * Flushes log buffer to file and stdout with cosmic efficiency.
 * @returns {Promise<void>}
 */
async function flushBuffer() {
  if (logBuffer.length === 0) return;
  const messages = logBuffer.join('');
  logBuffer = [];
  try {
    await rotateLog();
    logStream.write(messages);
    process.stdout.write(messages); // Ensure Docker captures logs
    logSize += Buffer.byteLength(messages);
  } catch (err) {
    console.error(`💥 Critical supernova error flushing log buffer: ${err.message}`);
  }
}

setInterval(flushBuffer, flushInterval);

/**
 * Logs a message with cosmic flair and optional progress emission.
 * @param {string} message - Message to log
 * @param {string} [level='INFO'] - Log level (INFO, ERROR, WARN, DEBUG)
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @param {string} [options.frontendId] - Frontend ID
 * @param {string} [options.ip] - IP address
 * @param {string} [options.taskName] - Task name
 * @param {string} [options.taskType] - Task type
 * @param {number} [options.progress] - Progress percentage (0-100)
 * @param {number} [options.fileCount] - Number of files generated
 * @param {number} [options.contentSize] - Total size of content in bytes
 * @param {Object} [options.jsonContent] - Structured JSON content
 * @param {boolean} [options.emitProgress=true] - Whether to emit progress to frontend
 * @returns {Promise<void>}
 */
export async function log(message, level = 'INFO', options = {}) {
  const {
    taskId,
    frontendId,
    ip,
    taskName,
    taskType,
    progress,
    fileCount,
    contentSize,
    jsonContent,
    emitProgress = true,
  } = options;
  const flair = {
    INFO: '🌟',
    ERROR: '💥',
    WARN: '⚠️',
    DEBUG: '🔍',
  }[level] || '🌟';
  const metadata = [
    taskId ? ` [Task: ${taskId}]` : '',
    taskName ? ` [Name: ${taskName}]` : '',
    taskType ? ` [Type: ${taskType}]` : '',
    progress !== undefined ? ` [Progress: ${progress}%]` : '',
    fileCount !== undefined ? ` [Files: ${fileCount}]` : '',
    contentSize !== undefined ? ` [Size: ${contentSize} bytes]` : '',
    jsonContent ? ` [JSON: ${Object.keys(jsonContent.files || {}).length} files]` : '',
  ].join('');
  const logMessage = `[${new Date().toISOString()}] ${level} ${flair}: ${message}${metadata}\n`;

  logBuffer.push(logMessage);

  const consoleMessage = `${flair} ${logMessage.trim()}`;
  if (level === 'ERROR') {
    console.error(consoleMessage);
  } else if (level === 'WARN') {
    console.warn(consoleMessage);
  } else {
    console.log(consoleMessage);
  }

  // Store log in Redis
  try {
    await redisClient.lPush(`logs:${taskId || 'general'}`, logMessage);
    await redisClient.lTrim(`logs:${taskId || 'general'}`, 0, 99);
  } catch (err) {
    console.error(`Failed to store log in Redis: ${err.message}`);
  }

  if (emitProgress && taskId && frontendId && (level === 'INFO' || level === 'DEBUG')) {
    await sendProgress(taskId, progress, message, frontendId, ip, taskName, taskType);
  }

  if (logBuffer.length >= maxBufferSize) await flushBuffer();
}

/**
 * Logs an error message with stack trace and detailed context.
 * @param {string} message - Error message
 * @param {Object} [options] - Optional metadata
 * @returns {Promise<void>}
 */
export async function error(message, options = {}) {
  const err = new Error(message);
  const stackMessage = `${message}\n${err.stack}`;
  await log(stackMessage, 'ERROR', options);
}

/**
 * Logs a warning message.
 * @param {string} message - Warning message
 * @param {Object} [options] - Optional metadata
 * @returns {Promise<void>}
 */
export async function warn(message, options = {}) {
  await log(message, 'WARN', options);
}

/**
 * Logs a debug message with detailed context.
 * @param {string} message - Debug message
 * @param {Object} [options] - Optional metadata
 * @returns {Promise<void>}
 */
export async function debug(message, options = {}) {
  await log(message, 'DEBUG', options);
}

/**
 * Sends progress update via WebSocket with cosmic swagger.
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} [taskName] - Task name
 * @param {string} [taskType] - Task type
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip, taskName, taskType) {
  if (!taskId || !frontendId) return;
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const socket = await botSocketPromise;
      if (!socket.connected) throw new Error('WebSocket not connected');
      const progressMessage = {
        type: 'progressUpdate',
        taskId,
        progress: percentage,
        text: `CrackerBot’s cosmic pulse: ${message}`,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        frontendId,
        ip: ip || 'unknown',
        taskName,
        taskType,
        messageId: `${taskId}-log-${Date.now()}`,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
        timestamp: new Date().toISOString(),
      };
      await socket.emit('message', progressMessage);
      await debug(`Progress supernova-beamed for task ${taskId}: ${message}`, { taskId, frontendId, ip, taskName, taskType, progress: percentage });
      return;
    } catch (err) {
      attempt++;
      await error(`Progress supernova-send failed for task ${taskId}, attempt ${attempt}/${maxRetries}: ${err.message}`, { taskId, frontendId, ip, taskName, taskType });
      if (attempt === maxRetries) return;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

process.on('beforeExit', async () => {
  await flushBuffer();
  logStream.end();
  await redisClient.quit();
});