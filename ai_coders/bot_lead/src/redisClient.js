// ai_coders/bot_lead/src/redisClient.js (ESM, v2025-03-28-2)
/* CrackerBot’s cosmic Redis wrapper—storing data with interstellar precision! 🌌 */
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

redisClient.on('error', async (err) => {
  await error('Redis client error: ' + err.message);
  if (botSocket && botSocket.connected) {
    botSocket.emit('message', {
      text: `Redis snag: ${err.message}. Cracker Bot’s still kicking, but caching might be off!`,
      type: 'error',
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  }
});

redisClient.on('connect', async () => await log('Connected to Redis'));
redisClient.on('ready', async () => await log('Redis connection established'));
redisClient.on('reconnecting', async () => await log('Reconnecting to Redis...'));

async function connectWithRetry() {
  let retries = 5;
  const delay = 1000;
  while (retries > 0) {
    try {
      await redisClient.connect();
      await log('Redis connection successful after retries');
      if (botSocket && botSocket.connected) {
        botSocket.emit('message', {
          text: 'Cracker Bot’s Redis link is live—full speed ahead!',
          type: 'system',
          from: 'Cracker Bot',
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

(async () => {
  await connectWithRetry();
})();

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

export async function getCompletedProjects(user) {
  try {
 recalled = await redisClient.sMembers(`completedProjects:${user}`);
    return recalled;
  } catch (err) {
    await error(`Failed to fetch completed projects for ${user}: ${err.message}`);
    return [];
  }
}

export async function getLatestProject(user) {
  try {
    const latestData = await redisClient.get(`project:${user}:latest`);
    return latestData ? JSON.parse(latestData) : null;
  } catch (err) {
    await error(`Failed to fetch latest project for ${user}: ${err.message}`);
    return null;
  }
}

export async function set(key, value) {
  try {
    await redisClient.set(key, JSON.stringify(value));
    await log(`Set key ${key}`);
  } catch (err) {
    await error(`Failed to set ${key}: ${err.message}`);
    throw err;
  }
}

export async function get(key) {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    await error(`Failed to get ${key}: ${err.message}`);
    return null;
  }
}

export async function sAdd(setKey, value) {
  try {
    await redisClient.sAdd(setKey, value);
    await log(`Added ${value} to set ${setKey}`);
  } catch (err) {
    await error(`Failed to add ${value} to set ${setKey}: ${err.message}`);
    throw err;
  }
}

export async function sMembers(setKey) {
  try {
    const members = await redisClient.sMembers(setKey);
    return members;
  } catch (err) {
    await error(`Failed to fetch members of set ${setKey}: ${err.message}`);
    return [];
  }
}

export async function hSet(hashKey, field, value) {
  try {
    await redisClient.hSet(hashKey, field, JSON.stringify(value));
    await log(`Set hash ${hashKey} field ${field}`);
  } catch (err) {
    await error(`Failed to set hash ${hashKey} field ${field}: ${err.message}`);
    throw err;
  }
}

export async function hGet(hashKey, field) {
  try {
    const value = await redisClient.hGet(hashKey, field);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    await error(`Failed to get hash ${hashKey} field ${field}: ${err.message}`);
    return null;
  }
}

export async function del(key) {
  try {
    await redisClient.del(key);
    await log(`Deleted key ${key}`);
  } catch (err) {
    await error(`Failed to delete ${key}: ${err.message}`);
    throw err;
  }
}

export async function hDel(hashKey, field) {
  try {
    await redisClient.hDel(hashKey, field);
    await log(`Deleted hash ${hashKey} field ${field}`);
  } catch (err) {
    await error(`Failed to delete hash ${hashKey} field ${field}: ${err.message}`);
    throw err;
  }
}