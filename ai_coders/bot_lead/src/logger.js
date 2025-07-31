// bot_lead/src/logger.js
// Version: v2025-07-21-03
/**
 * Logger Module
 * Provides cosmic logging for CrackerBot with flair and precision.
 * Enhanced by xAI for robust error handling and Redis integration.
 *
 * @version 2025-07-21-03
 * @author CrackerBot Team, enhanced by xAI
 * @module logger
 */

import { createClient } from 'redis';

// Initialize log buffer
const logBuffer = [];

// Redis client for logging
const redisLogClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  password: process.env.REDIS_PASSWORD || 'new_secure_password',
});

// Redis error handling
redisLogClient.on('error', (err) => {
  console.error(`Redis log client error: ${err.message}`);
});

// Connect to Redis
async function connectRedis() {
  try {
    await redisLogClient.connect();
    console.log('Redis logging connection established');
  } catch (err) {
    console.error(`Redis logging connection failed: ${err.message}`);
  }
}
connectRedis();

/**
 * Logs a message with cosmic style.
 * @async
 * @param {string} message - The log message
 * @param {Object} [context={}] - Additional context
 * @returns {Promise<void>}
 */
export async function log(message, context = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      level: 'INFO',
      timestamp,
      message,
      context: { ...context, bot: 'bot_lead' },
    };
    logBuffer.push(logEntry);
    console.log(`🌟 [${timestamp}] INFO 🌟: ${message}`, context);

    if (redisLogClient.isOpen) {
      await redisLogClient.lPush('logs:bot_lead', JSON.stringify(logEntry));
      await redisLogClient.lTrim('logs:bot_lead', 0, 999);
    }

    if (logBuffer.length > 1000) {
      logBuffer.splice(0, logBuffer.length - 500);
    }
  } catch (err) {
    console.error(`Failed to log: ${err.message}`);
  }
}

/**
 * Logs an error with cosmic urgency.
 * @async
 * @param {string} message - The error message
 * @param {Object} [context={}] - Additional context
 * @returns {Promise<void>}
 */
export async function error(message, context = {}) {
  try {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      level: 'ERROR',
      timestamp,
      message,
      context: { ...context, bot: 'bot_lead' },
    };
    logBuffer.push(errorEntry);
    console.error(`💥 [${timestamp}] ERROR 💥: ${message}`, context);

    if (redisLogClient.isOpen) {
      await redisLogClient.lPush('logs:bot_lead', JSON.stringify(errorEntry));
      await redisLogClient.lTrim('logs:bot_lead', 0, 999);
    }

    if (logBuffer.length > 1000) {
      logBuffer.splice(0, logBuffer.length - 500);
    }
  } catch (err) {
    console.error(`Failed to log error: ${err.message}`);
  }
}
