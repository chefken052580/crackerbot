// ai_coders/bot_backend/src/logger.js
// Version: v2025-03-28-12
import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
import { botSocket } from './socket.js'; // For potential progress hooks

const logDir = process.env.LOG_DIR || './logs';
const dateStr = new Date().toISOString().split('T')[0];
const logFile = path.join(logDir, `bot_backend_${dateStr}.log`);
const maxLogSize = 10 * 1024 * 1024; // 10MB

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

let logStream = createWriteStream(logFile, { flags: 'a' });
let logSize = 0;

// Buffer for batch writing
let logBuffer = [];
const flushInterval = 1000; // Flush every 1s

/**
 * Rotates log file if size exceeds limit.
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
      await log(`🌌 Log rotated to ${archiveFile}`, 'INFO');
    }
  } catch (err) {
    console.error(`Critical error rotating log: ${err.message}`);
  }
}

/**
 * Flushes log buffer to file.
 * @returns {Promise<void>}
 */
async function flushBuffer() {
  if (logBuffer.length === 0) return;
  const messages = logBuffer.join('');
  logBuffer = [];
  try {
    await rotateLog();
    logStream.write(messages);
    logSize += Buffer.byteLength(messages);
  } catch (err) {
    console.error(`Critical error flushing log buffer: ${err.message}`);
  }
}

// Periodic flush
setInterval(flushBuffer, flushInterval);

/**
 * Logs a message with cosmic flair.
 * @param {string} message - Message to log
 * @param {string} [level='INFO'] - Log level (INFO, ERROR, WARN)
 * @param {Object} [options] - Optional metadata
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @returns {Promise<void>}
 */
export async function log(message, level = 'INFO', options = {}) {
  const { taskId, frontendId, ip } = options;
  const flair = {
    INFO: '🌟',
    ERROR: '💥',
    WARN: '⚠️',
  }[level] || '🌟';
  const logMessage = `[${new Date().toISOString()}] ${level} ${flair}: ${message}\n`;
  
  logBuffer.push(logMessage);
  
  // Console output with flair
  const consoleMessage = `${flair} ${logMessage.trim()}`;
  if (level === 'ERROR') {
    console.error(consoleMessage);
  } else if (level === 'WARN') {
    console.warn(consoleMessage);
  } else {
    console.log(consoleMessage);
  }

  // Optional progress hook (future use)
  if (taskId && level === 'INFO') {
    await sendProgress(taskId, null, message, frontendId, ip);
  }

  // Flush buffer if it’s large enough
  if (logBuffer.length > 100) await flushBuffer();
}

/**
 * Logs an error message.
 * @param {string} message - Error message
 * @param {Object} [options] - Optional metadata
 * @returns {Promise<void>}
 */
export async function error(message, options = {}) {
  await log(message, 'ERROR', options);
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
 * Sends progress update via WebSocket (placeholder for integration).
 * @param {string} taskId - Task ID
 * @param {number|null} percentage - Progress (0-100) or null for info-only
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip) {
  if (!botSocket || !taskId) return;
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `CrackerBot’s cosmic log: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    messageId: `${taskId}-log-${Date.now()}`,
  };
  try {
    botSocket.emit('message', progressMessage);
  } catch (err) {
    console.error(`Progress send failed for ${taskId}: ${err.message}`);
  }
}

// Cleanup on process exit
process.on('beforeExit', () => {
  flushBuffer().then(() => logStream.end());
});

// Example usage:
// await log('Server started');
// await error('Failed to connect');
// await warn('Resource usage high');