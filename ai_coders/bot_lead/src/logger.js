// ai_coders/bot_lead/src/logger.js
// Version: v2025-04-09-01
import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join(logDir, 'bot_lead.log');

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

let logBuffer = [];
const flushInterval = 1000; // Flush every 1s

/**
 * Flushes log buffer to file.
 * @async
 * @returns {Promise<void>}
 */
async function flushBuffer() {
  if (logBuffer.length === 0) return;
  const messages = logBuffer.join('');
  logBuffer = [];
  try {
    await fs.appendFile(logFile, messages);
  } catch (err) {
    console.error('Critical error writing to log:', err);
  }
}

setInterval(flushBuffer, flushInterval);

/**
 * Logs a message with timestamp and optional metadata.
 * @async
 * @param {string} message - Message to log
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @returns {Promise<void>}
 */
export async function log(message, options = {}) {
  const { taskId } = options;
  const logMessage = `[${new Date().toISOString()}] INFO: ${message}${taskId ? ` [Task: ${taskId}]` : ''}\n`;
  logBuffer.push(logMessage);
  console.log(logMessage.trim());
  if (logBuffer.length > 100) await flushBuffer();
}

/**
 * Logs an error message with timestamp and optional metadata.
 * @async
 * @param {string} message - Error message
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @returns {Promise<void>}
 */
export async function error(message, options = {}) {
  const { taskId } = options;
  const logMessage = `[${new Date().toISOString()}] ERROR: ${message}${taskId ? ` [Task: ${taskId}]` : ''}\n`;
  logBuffer.push(logMessage);
  console.error(logMessage.trim());
  if (logBuffer.length > 100) await flushBuffer();
}

/**
 * Logs a warning message with timestamp and optional metadata.
 * @async
 * @param {string} message - Warning message
 * @param {Object} [options] - Optional metadata
 * @param {string} [options.taskId] - Task ID
 * @returns {Promise<void>}
 */
export async function warn(message, options = {}) {
  const { taskId } = options;
  const logMessage = `[${new Date().toISOString()}] WARN: ${message}${taskId ? ` [Task: ${taskId}]` : ''}\n`;
  logBuffer.push(logMessage);
  console.warn(logMessage.trim());
  if (logBuffer.length > 100) await flushBuffer();
}

// Cleanup on exit
process.on('beforeExit', async () => {
  await flushBuffer();
});