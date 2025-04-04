// ai_coders/bot_lead/src/redisClient.js (ESM, v2025-04-02-02)
/**
 * CrackerBot’s Cosmic Redis Wrapper
 * Stores data with interstellar precision and supernova resilience!
 * Enhanced by xAI for robust error handling and JSON consistency.
 *
 * @version 2025-04-02-02
 * @author CrackerBot Team, enhanced by xAI
 * @module redisClient
 */

import { createClient } from 'redis';
import { log, error } from './logger.js';
import config from './config.js';
import { botSocket } from './socket.js';

export const redisClient = createClient({
  url: 'redis://redis:6379',
  password: config.redis.password || undefined,
  database: config.redis.db,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis reconnect retries exhausted');
      return Math.min(retries * 100, 3000);
    },
  },
});

/**
 * Redis client instance for cosmic data storage.
 * @type {import('redis').RedisClientType}
 */
redisClient.on('error', async (err) => {
  await error('Redis client error: ' + err.message);
  if (botSocket && botSocket.connected) {
    botSocket.emit('message', {
      text: `Redis snag: ${err.message}. Cracker Bot’s still kicking, but caching might be off!`,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
    });
  }
});

redisClient.on('connect', async () => await log('Connected to Redis'));
redisClient.on('ready', async () => await log('Redis connection established'));
redisClient.on('reconnecting', async () => await log('Reconnecting to Redis...'));

/**
 * Connects to Redis with retry logic and cosmic resilience.
 * @async
 * @function connectWithRetry
 * @returns {Promise<void>}
 * @throws {Error} If retries are exhausted
 */
async function connectWithRetry() {
  let retries = 5;
  const delay = 1000;
  while (retries > 0) {
    try {
      await redisClient.connect();
      await log('Redis connection successful after retries');
      if (botSocket && botSocket.connected) {
        botSocket.emit('message', {
          text: 'CrackerBot’s Redis link is live—full speed ahead!',
          type: 'system',
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
        });
      }
      return;
    } catch (err) {
      retries--;
      await error(`Failed to connect to Redis (retries left: ${retries}): ${err.message}`);
      if (retries === 0) {
        await error('Redis connection exhausted retries - throwing error');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Stores a message in Redis with a capped list for cosmic efficiency.
 * @async
 * @function storeMessage
 * @param {string} user - User identifier
 * @param {string} text - Message content
 * @returns {Promise<void>}
 */
export async function storeMessage(user, text) {
  const key = `messages:${user || 'anonymous'}`;
  try {
    await redisClient.lPush(key, text);
    await redisClient.lTrim(key, 0, 9);
    await log(`Stored message for ${user}: ${text.substring(0, 50)}...`);
  } catch (err) {
    await error(`Failed to store message for ${user}: ${err.message}`);
  }
}

/**
 * Caches a completed task in Redis with galactic permanence.
 * @async
 * @function cacheTask
 * @param {Object} task - Task data
 * @param {string} task.taskId - Unique task identifier
 * @param {string} task.user - User name
 * @param {string} task.frontendId - Frontend identifier
 * @param {string} task.ip - Client IP
 * @param {string} task.name - Project name
 * @param {string} task.type - Project type
 * @param {string} task.fileName - File name
 * @param {string} task.content - Task content
 * @param {string} [task.features] - Project features
 * @param {number} [task.version] - Version number
 * @param {string|null} [task.network] - Network (optional)
 * @returns {Promise<void>}
 * @throws {Error} If caching fails
 */
export async function cacheTask(task) {
  const { taskId, user, frontendId, ip, name, type, fileName, content, features, version, network } = task;
  const taskKey = `project:${user}:${taskId}`;
  try {
    const taskData = {
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName,
      content,
      user,
      features: features || 'basic functionality',
      version: version || 1,
      network: network || null,
      completed: true,
      timestamp: new Date().toISOString(),
    };
    await redisClient.set(taskKey, JSON.stringify(taskData));
    await redisClient.set(`project:${user}:latest`, JSON.stringify(taskData));
    await redisClient.sAdd(`completedProjects:${user}`, taskId);
    await redisClient.hSet('tasks', taskId, JSON.stringify({ ...task, status: 'completed' }));
    await log(`Cached task ${taskId} for ${user} at ${taskKey}`);
  } catch (err) {
    await error(`Failed to cache task ${taskId} for ${user}: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieves a task from Redis by user and taskId.
 * @async
 * @function getTask
 * @param {string} user - User name
 * @param {string} taskId - Task identifier
 * @returns {Promise<Object|null>} Task data or null if not found
 */
export async function getTask(user, taskId) {
  const taskKey = `project:${user}:${taskId}`;
  try {
    const taskData = await redisClient.get(taskKey);
    return taskData ? JSON.parse(taskData) : null;
  } catch (err) {
    await error(`Failed to fetch task ${taskId} for ${user}: ${err.message}`);
    return null;
  }
}

/**
 * Fetches all completed project IDs for a user from Redis.
 * @async
 * @function getCompletedProjects
 * @param {string} user - User name
 * @returns {Promise<string[]>} Array of task IDs
 */
export async function getCompletedProjects(user) {
  try {
    const members = await redisClient.sMembers(`completedProjects:${user}`);
    return members;
  } catch (err) {
    await error(`Failed to fetch completed projects for ${user}: ${err.message}`);
    return [];
  }
}

/**
 * Retrieves the latest project for a user from Redis.
 * @async
 * @function getLatestProject
 * @param {string} user - User name
 * @returns {Promise<Object|null>} Latest project data or null
 */
export async function getLatestProject(user) {
  try {
    const latestData = await redisClient.get(`project:${user}:latest`);
    return latestData ? JSON.parse(latestData) : null;
  } catch (err) {
    await error(`Failed to fetch latest project for ${user}: ${err.message}`);
    return null;
  }
}

/**
 * Retrieves pending tasks for a frontendId from Redis.
 * @async
 * @function getPendingTasks
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<Object[]>} Array of pending task data
 */
export async function getPendingTasks(frontendId) {
  try {
    const allPending = await redisClient.hGetAll('pendingTasks');
    const pendingTasks = Object.entries(allPending)
      .map(([taskId, data]) => ({ taskId, ...JSON.parse(data) }))
      .filter(task => task.frontendId === frontendId && task.status === 'pending');
    await log(`Fetched ${pendingTasks.length} pending tasks for frontendId ${frontendId}`);
    return pendingTasks;
  } catch (err) {
    await error(`Failed to fetch pending tasks for frontendId ${frontendId}: ${err.message}`);
    return [];
  }
}

/**
 * Sets a key-value pair in Redis with JSON consistency.
 * @async
 * @function set
 * @param {string} key - Redis key
 * @param {any} value - Value to store (stringified as JSON)
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function set(key, value) {
  try {
    const jsonValue = JSON.stringify(value); // Always store as JSON
    await redisClient.set(key, jsonValue);
    await log(`Set key ${key}`);
  } catch (err) {
    await error(`Failed to set ${key}: ${err.message}`);
    throw err;
  }
}

/**
 * Gets a value from Redis, parsing it as JSON.
 * @async
 * @function get
 * @param {string} key - Redis key
 * @returns {Promise<any|null>} Parsed value or null if not found
 */
export async function get(key) {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null; // Always parse as JSON
  } catch (err) {
    await error(`Failed to get ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Adds a value to a Redis set.
 * @async
 * @function sAdd
 * @param {string} setKey - Set key
 * @param {string} value - Value to add
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function sAdd(setKey, value) {
  try {
    await redisClient.sAdd(setKey, value);
    await log(`Added ${value} to set ${setKey}`);
  } catch (err) {
    await error(`Failed to add ${value} to set ${setKey}: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieves all members of a Redis set.
 * @async
 * @function sMembers
 * @param {string} setKey - Set key
 * @returns {Promise<string[]>} Array of set members
 */
export async function sMembers(setKey) {
  try {
    const members = await redisClient.sMembers(setKey);
    return members;
  } catch (err) {
    await error(`Failed to fetch members of set ${setKey}: ${err.message}`);
    return [];
  }
}

/**
 * Sets a field in a Redis hash.
 * @async
 * @function hSet
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @param {any} value - Value to store (stringified)
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function hSet(hashKey, field, value) {
  try {
    await redisClient.hSet(hashKey, field, JSON.stringify(value));
    await log(`Set hash ${hashKey} field ${field}`);
  } catch (err) {
    await error(`Failed to set hash ${hashKey} field ${field}: ${err.message}`);
    throw err;
  }
}

/**
 * Gets a field from a Redis hash.
 * @async
 * @function hGet
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @returns {Promise<any|null>} Parsed value or null if not found
 */
export async function hGet(hashKey, field) {
  try {
    const value = await redisClient.hGet(hashKey, field);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    await error(`Failed to get hash ${hashKey} field ${field}: ${err.message}`);
    return null;
  }
}

/**
 * Deletes a key from Redis.
 * @async
 * @function del
 * @param {string} key - Redis key
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function del(key) {
  try {
    await redisClient.del(key);
    await log(`Deleted key ${key}`);
  } catch (err) {
    await error(`Failed to delete ${key}: ${err.message}`);
    throw err;
  }
}

/**
 * Deletes a field from a Redis hash.
 * @async
 * @function hDel
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function hDel(hashKey, field) {
  try {
    await redisClient.hDel(hashKey, field);
    await log(`Deleted hash ${hashKey} field ${field}`);
  } catch (err) {
    await error(`Failed to delete hash ${hashKey} field ${field}: ${err.message}`);
    throw err;
  }
}

// Ignition with cosmic flair
(async () => {
  await connectWithRetry();
})();