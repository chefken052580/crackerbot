// bot_backend/src/redisClient.js
// Version: v2025-07-26-01
/**
 * Redis Client Module
 * Establishes CrackerBot’s cosmic connection to Redis with retry logic and authentication for bot_backend.
 * Enhanced by xAI for robust connection handling, error resilience, and progress caching.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module redisClient
 */

import { createClient } from 'redis';
import { log, error } from './logger.js';

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'crackerbot';
const REDIS_DB = process.env.REDIS_DB || 0;

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
  password: REDIS_PASSWORD,
});

const redisClientPromise = (async () => {
  let attempt = 0;
  const maxRetries = 5;

  while (attempt < maxRetries) {
    try {
      await log(`Connecting to Redis, attempt ${attempt + 1}/${maxRetries}`, { taskId: 'redis' });
      await redisClient.connect();
      await log('Redis connection established—cosmic cache online for bot_backend!', { taskId: 'redis' });
      return redisClient;
    } catch (err) {
      attempt++;
      await error(`Redis connection failed: ${err.message}, attempt ${attempt}/${maxRetries}`, { taskId: 'redis' });
      if (attempt === maxRetries) {
        throw new Error(`Redis connection failed after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
    }
  }
})();

redisClient.on('error', async (err) => {
  await error(`Redis client error: ${err.message}`, { taskId: 'redis' });
});

redisClient.on('connect', async () => {
  await log('Redis logging connection established—galactic persistence ready for bot_backend!', { taskId: 'redis' });
});

/**
 * Validates JSON string.
 * @param {string} str - String to validate
 * @returns {boolean} True if valid JSON
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets a key-value pair in Redis with JSON consistency.
 * @async
 * @param {string} key - Redis key
 * @param {any} value - Value to store (stringified as JSON)
 * @param {number} [ttl] - Time-to-live in seconds (optional)
 * @returns {Promise<void>}
 */
async function set(key, value, ttl) {
  try {
    const jsonValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, jsonValue);
      await log(`Set key ${key} with TTL ${ttl}s`, { taskId: 'redis' });
    } else {
      await redisClient.set(key, jsonValue);
      await log(`Set key ${key}`, { taskId: 'redis' });
    }
  } catch (err) {
    await error(`Failed to set ${key}: ${err.message}`, { taskId: 'redis' });
    throw err;
  }
}

/**
 * Gets a value from Redis, parsing it as JSON.
 * @async
 * @param {string} key - Redis key
 * @returns {Promise<any|null>} Parsed value or null if not found
 */
async function get(key) {
  try {
    const value = await redisClient.get(key);
    return value && isValidJSON(value) ? JSON.parse(value) : null;
  } catch (err) {
    await error(`Failed to get ${key}: ${err.message}`, { taskId: 'redis' });
    return null;
  }
}

/**
 * Retrieves all keys matching a pattern from Redis.
 * @async
 * @param {string} pattern - Key pattern
 * @returns {Promise<string[]>} Array of matching keys
 */
async function keys(pattern) {
  try {
    const matchingKeys = await redisClient.keys(pattern);
    await log(`Fetched ${matchingKeys.length} keys matching pattern ${pattern}`, { taskId: 'redis' });
    return matchingKeys;
  } catch (err) {
    await error(`Failed to fetch keys for pattern ${pattern}: ${err.message}`, { taskId: 'redis' });
    return [];
  }
}

/**
 * Deletes a key from Redis.
 * @async
 * @param {string|string[]} key - Redis key or array of keys
 * @returns {Promise<void>}
 */
async function del(key) {
  try {
    await redisClient.del(key);
    await log(`Deleted key(s) ${Array.isArray(key) ? key.join(', ') : key}`, { taskId: 'redis' });
  } catch (err) {
    await error(`Failed to delete ${Array.isArray(key) ? key.join(', ') : key}: ${err.message}`, { taskId: 'redis' });
    throw err;
  }
}

/**
 * Sets a field in a Redis hash.
 * @async
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @param {any} value - Value to store (stringified)
 * @returns {Promise<void>}
 */
async function hSet(hashKey, field, value) {
  try {
    await redisClient.hSet(hashKey, field, JSON.stringify(value));
    await log(`Set hash ${hashKey} field ${field}`, { taskId: 'redis' });
  } catch (err) {
    await error(`Failed to set hash ${hashKey} field ${field}: ${err.message}`, { taskId: 'redis' });
    throw err;
  }
}

/**
 * Gets a field from a Redis hash.
 * @async
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @returns {Promise<any|null>} Parsed value or null if not found
 */
async function hGet(hashKey, field) {
  try {
    const value = await redisClient.hGet(hashKey, field);
    return value && isValidJSON(value) ? JSON.parse(value) : null;
  } catch (err) {
    await error(`Failed to get hash ${hashKey} field ${field}: ${err.message}`, { taskId: 'redis' });
    return null;
  }
}

/**
 * Gets all fields from a Redis hash.
 * @async
 * @param {string} hashKey - Hash key
 * @returns {Promise<Object>} Object of field-value pairs
 */
async function hGetAll(hashKey) {
  try {
    const values = await redisClient.hGetAll(hashKey);
    const parsed = {};
    for (const [field, value] of Object.entries(values)) {
      if (isValidJSON(value)) {
        parsed[field] = JSON.parse(value);
      } else {
        await redisClient.hDel(hashKey, field);
        await log(`Cleared corrupted hash ${hashKey} field ${field}`, { taskId: 'redis' });
      }
    }
    await log(`Fetched hash ${hashKey} with ${Object.keys(parsed).length} fields`, { taskId: 'redis' });
    return parsed;
  } catch (err) {
    await error(`Failed to fetch hash ${hashKey}: ${err.message}`, { taskId: 'redis' });
    return {};
  }
}

/**
 * Deletes a field from a Redis hash.
 * @async
 * @param {string} hashKey - Hash key
 * @param {string} field - Field name
 * @returns {Promise<void>}
 */
async function hDel(hashKey, field) {
  try {
    await redisClient.hDel(hashKey, field);
    await log(`Deleted hash ${hashKey} field ${field}`, { taskId: 'redis' });
  } catch (err) {
    await error(`Failed to delete hash ${hashKey} field ${field}: ${err.message}`, { taskId: 'redis' });
    throw err;
  }
}

/**
 * Adds a value to a Redis set.
 * @async
 * @param {string} setKey - Set key
 * @param {string} value - Value to add
 * @returns {Promise<void>}
 */
async function sAdd(setKey, value) {
  try {
    await redisClient.sAdd(setKey, value);
    await log(`Added ${value} to set ${setKey}`, { taskId: 'redis' });
  } catch (err) {
    await error(`Failed to add ${value} to set ${setKey}: ${err.message}`, { taskId: 'redis' });
    throw err;
  }
}

/**
 * Retrieves all members of a Redis set.
 * @async
 * @param {string} setKey - Set key
 * @returns {Promise<string[]>} Array of set members
 */
async function sMembers(setKey) {
  try {
    const members = await redisClient.sMembers(setKey);
    await log(`Fetched ${members.length} members from set ${setKey}`, { taskId: 'redis' });
    return members;
  } catch (err) {
    await error(`Failed to fetch members of set ${setKey}: ${err.message}`, { taskId: 'redis' });
    return [];
  }
}

export { redisClient, redisClientPromise, isValidJSON, set, get, keys, del, hSet, hGet, hGetAll, hDel, sAdd, sMembers };