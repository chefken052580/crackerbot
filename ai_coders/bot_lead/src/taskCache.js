// ai_coders/bot_lead/src/taskCache.js
import { log, error } from './logger.js';
import { set } from './redisClient.js'; // Updated import to use 'set' directly

export async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, ip, name, type, fileName, content, user, features, version, network } = task;
    const cacheKey = `project:${user}:${taskId}`;
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
      completed: true, // Mark as completed, consistent with taskHandlers.js
    };
    await set(cacheKey, taskData); // Use 'set' from redisClient.js
    await log(`Cached completed task ${taskId} for ${user} - locked and loaded!`);
  } catch (err) {
    await error(`Caching task ${task.taskId} for ${user} flopped: ${err.message}`);
  }
}