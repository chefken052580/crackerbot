// ai_coders/bot_lead/src/taskCache.js
import { log, error } from './logger.js';
import { cacheTask } from './redisClient.js';

export async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, ip, name, type, fileName, content, user, features, version, network } = task;
    await cacheTask({
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
    });
    await log(`Cached completed task ${taskId} for ${user} - locked and loaded!`);
  } catch (err) {
    await error(`Caching task ${task.taskId} for ${user} flopped: ${err.message}`);
  }
}