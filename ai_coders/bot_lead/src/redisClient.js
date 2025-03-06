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

async function connectWithRetry() {
  let retries = 5;
  const delay = 1000;
  while (retries > 0) {
    try {
      await redisClient.connect();
      await log('Redis connection established');
      return;
    } catch (err) {
      retries--;
      await error(`Failed to connect to Redis (retries left: ${retries}): ${err.message}`);
      if (retries === 0) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

(async () => {
  await connectWithRetry();
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