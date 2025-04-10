// ai_coders/bot_backend/src/logger.js
// Version: v2025-04-10-16
/* CrackerBot’s cosmic log forge—capturing the galaxy’s pulse with supernova precision! 🌌 */

import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
import { botSocket, emit } from './socket.js';

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
      console.log(`🌌 Log rotated to ${archiveFile}`); // Direct stdout for Docker
      await log(`🌌 Log rotated to ${archiveFile}`, 'INFO');
    }
  } catch (err) {
    console.error(`💥 Critical error rotating log: ${err.message}`);
  }
}

/**
 * Flushes log buffer to file and stdout.
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
    console.error(`💥 Critical error flushing log buffer: ${err.message}`);
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

  if (emitProgress && taskId && frontendId && (level === 'INFO' || level === 'DEBUG')) {
    await sendProgress(taskId, progress, message, frontendId, ip, taskName, taskType);
  }

  if (logBuffer.length > maxBufferSize) await flushBuffer();
}

/**
 * Logs an error message with stack trace and detailed context.
 * @param {string} message - Error message
 * @param {Object} [options] - Optional metadata
 * @returns {Promise<void>}
 */
export async function error(message, options = {}) {
  const err = new Error(message);
  const stackMessage = `${message}\n${err

.stack}`;
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
 * Sends progress update via WebSocket using socket.js emit function.
 * @param {string} taskId - Task ID
 * @param {number|null} percentage - Progress (0-100) or null
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} [taskName] - Task name
 * @param {string} [taskType] - Task type
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip, taskName, taskType) {
  if (!taskId || !frontendId) return;
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage !== null && percentage !== undefined ? percentage : undefined,
    text: `🌌 CrackerBot’s cosmic log: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip: ip || 'unknown',
    taskName,
    taskType,
    messageId: `${taskId}-log-${Date.now()}`,
    bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' }, // Match taskExecution.js
  };
  try {
    await emit('message', progressMessage, (ack) => {
      if (ack?.status !== 'success') {
        console.warn(`Progress ack failed for task ${taskId}: ${JSON.stringify(ack)}`);
      }
    });
    await debug(`Progress beamed for task ${taskId}: ${message}`, { taskId, frontendId, ip, taskName, taskType, progress: percentage });
  } catch (err) {
    await error(`Progress send failed for task ${taskId}: ${err.message}`, { taskId, frontendId, ip, taskName, taskType });
  }
}

process.on('beforeExit', async () => {
  await flushBuffer();
  logStream.end();
});