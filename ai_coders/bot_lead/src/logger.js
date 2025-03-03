import fs from 'fs/promises'; // Use ES module fs.promises for async operations
import path from 'path';
import { mkdirSync, existsSync } from 'fs'; // Keep sync methods from fs

const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join(logDir, 'bot_lead.log');

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

export async function log(message) {
  const logMessage = `[${new Date().toISOString()}] INFO: ${message}\n`;
  try {
    await fs.appendFile(logFile, logMessage);
    console.log(logMessage);
  } catch (err) {
    console.error('Error writing to log:', err);
  }
}

export async function error(message) {
  const logMessage = `[${new Date().toISOString()}] ERROR: ${message}\n`;
  try {
    await fs.appendFile(logFile, logMessage);
    console.error(logMessage);
  } catch (err) {
    console.error('Critical error writing to log:', err);
  }
}

export async function warn(message) {
  const logMessage = `[${new Date().toISOString()}] WARN: ${message}\n`;
  try {
    await fs.appendFile(logFile, logMessage);
    console.warn(logMessage);
  } catch (err) {
    console.error('Error writing warning to log:', err);
  }
}