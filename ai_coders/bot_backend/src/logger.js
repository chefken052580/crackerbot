// ai_coders/bot_backend/src/logger.js
// Version: v2025-04-09-13
import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
import { botSocket } from './socket.js'; // For WebSocket progress hooks

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
    console.error(`💥 Critical error rotating log: ${err.message}`);
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
    console.error(`💥 Critical error flushing log buffer: ${err.message}`);
  }
}

setInterval(flushBuffer, flushInterval);

/**
 * Logs a message with cosmic flair and optional progress emission.
 * @param {string} message - Message to log
 * @param {string} [level='INFO'] - Log level (INFO, ERROR, WARN, DEBUG)
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID for progress tracking
 * @param {string} [options.frontendId] - Frontend ID for WebSocket
 * @param {string} [options.ip] - IP address for WebSocket
 * @param {string} [options.taskName] - Task name for context
 * @param {string} [options.taskType] - Task type for context
 * @param {number} [options.progress] - Progress percentage (0-100)
 * @returns {Promise<void>}
 */
export async function log(message, level = 'INFO', options = {}) {
  const { taskId, frontendId, ip, taskName, taskType, progress } = options;
  const flair = {
    INFO: '🌟',
    ERROR: '💥',
    WARN: '⚠️',
    DEBUG: '🔍',
  }[level] || '🌟';
  const logMessage = `[${new Date().toISOString()}] ${level} ${flair}: ${message}${taskId ? ` [Task: ${taskId}]` : ''}${taskName ? ` [Name: ${taskName}]` : ''}${taskType ? ` [Type: ${taskType}]` : ''}\n`;

  logBuffer.push(logMessage);

  const consoleMessage = `${flair} ${logMessage.trim()}`;
  if (level === 'ERROR') {
    console.error(consoleMessage);
  } else if (level === 'WARN') {
    console.warn(consoleMessage);
  } else {
    console.log(consoleMessage);
  }

  if (taskId && (level === 'INFO' || level === 'DEBUG')) {
    await sendProgress(taskId, progress, message, frontendId, ip, taskName, taskType);
  }

  if (logBuffer.length > 100) await flushBuffer();
}

/**
 * Logs an error message with cosmic flair.
 * @param {string} message - Error message
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @param {string} [options.frontendId] - Frontend ID
 * @param {string} [options.ip] - IP address
 * @param {string} [options.taskName] - Task name
 * @param {string} [options.taskType] - Task type
 * @returns {Promise<void>}
 */
export async function error(message, options = {}) {
  await log(message, 'ERROR', options);
}

/**
 * Logs a warning message with cosmic flair.
 * @param {string} message - Warning message
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @param {string} [options.frontendId] - Frontend ID
 * @param {string} [options.ip] - IP address
 * @param {string} [options.taskName] - Task name
 * @param {string} [options.taskType] - Task type
 * @returns {Promise<void>}
 */
export async function warn(message, options = {}) {
  await log(message, 'WARN', options);
}

/**
 * Logs a debug message with cosmic flair.
 * @param {string} message - Debug message
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @param {string} [options.frontendId] - Frontend ID
 * @param {string} [options.ip] - IP address
 * @param {string} [options.taskName] - Task name
 * @param {string} [options.taskType] - Task type
 * @returns {Promise<void>}
 */
export async function debug(message, options = {}) {
  await log(message, 'DEBUG', options);
}

/**
 * Sends progress update via WebSocket with cosmic flair.
 * @param {string} taskId - Task ID
 * @param {number|null} percentage - Progress (0-100) or null for info-only
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} [taskName] - Task name
 * @param {string} [taskType] - Task type
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip, taskName, taskType) {
  if (!botSocket || !taskId || !frontendId) return;
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage !== null ? percentage : undefined,
    text: `🌌 CrackerBot’s cosmic log: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    taskName,
    taskType,
    messageId: `${taskId}-log-${Date.now()}`,
  };
  try {
    botSocket.emit('message', progressMessage);
    await log(`Progress beamed for task ${taskId}: ${message}`, 'DEBUG', { taskId, frontendId, ip, taskName, taskType, progress: percentage });
  } catch (err) {
    await error(`Progress send failed for task ${taskId}: ${err.message}`, { taskId, frontendId, ip, taskName, taskType });
  }
}

process.on('beforeExit', () => {
  flushBuffer().then(() => logStream.end());
});

// Example usage:
// await log('Server ignited with supernova energy!', 'INFO');
// await error('Cosmic connection lost!', { taskId: '123' });
// await debug('Processing task step 1', { taskId: '123', taskName: 'crabs', taskType: 'html', progress: 25 });