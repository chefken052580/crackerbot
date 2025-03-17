import fs from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';

const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join(logDir, `bot_backend_${new Date().toISOString().split('T')[0]}.log`); // Daily logs

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const logStream = createWriteStream(logFile, { flags: 'a' });

export async function log(message, level = 'INFO') {
  const logMessage = `[${new Date().toISOString()}] ${level}: ${message}\n`;
  try {
    logStream.write(logMessage);
    if (level === 'ERROR') {
      console.error(logMessage.trim());
    } else if (level === 'WARN') {
      console.warn(logMessage.trim());
    } else {
      console.log(logMessage.trim());
    }
  } catch (err) {
    console.error('Critical error writing to log:', err);
    // Optionally, add retry logic or external alerts here
  }
}

export async function error(message) {
  await log(message, 'ERROR');
}

export async function warn(message) {
  await log(message, 'WARN');
}

// Example usage:
// await log('Server started');
// await error('Failed to connect');
// await warn('Resource usage high');