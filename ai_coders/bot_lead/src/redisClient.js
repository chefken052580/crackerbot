import { createClient } from 'redis';
import { log, error } from './logger.js';
import config from './config.js';

export const redisClient = createClient({
  url: 'redis://redis:6379',
  password: config.redis.password || undefined,
  database: config.redis.db,
});

redisClient.on('error', async (err) => await error('Redis client error: ' + err.message));
redisClient.on('connect', async () => await log('Connected to Redis'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    await error('Failed to connect to Redis: ' + err.message);
  }
})();

export async function storeMessage(user, text) {
  const key = `messages:${user || 'anonymous'}`;
  try {
    await redisClient.lPush(key, text);
    await redisClient.lTrim(key, 0, 9);
  } catch (err) {
    await error('Failed to store message: ' + err.message);
  }
}