// ai_coders/bot_lead/src/taskCache.js (ESM, v2025-03-28-4)
/* CrackerBot’s cosmic vault—caching completed tasks with interstellar flair! 🌌 */
import { log, error } from './logger.js';
import { set, get, del } from './redisClient.js';
import { redisClient } from './redisClient.js';

/**
 * Caches a completed task in Redis with cosmic flair.
 * @param {Object} task - Task data to cache
 * @returns {Promise<Object|null>} Cached task data or null on failure
 */
export async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, ip, name, type, fileName, content, user, features, version, network } = task;
    if (!taskId || !user) {
      throw new Error('Missing taskId or user—cosmic coordinates incomplete!');
    }

    const cacheKey = `project:${user}:${taskId}`;
    const taskData = {
      taskId,
      frontendId: frontendId || 'unknown',
      ip: ip || 'unknown',
      name: name || 'unnamed_project',
      type: type || 'unknown',
      fileName: fileName || `${name || 'project'}.zip`,
      content: content || null,
      user,
      features: features || 'basic functionality',
      version: version || 1,
      network: network || null,
      status: 'completed', // Fixed to align with getCompletedProjects
      timestamp: new Date().toISOString(),
    };
    await set(cacheKey, taskData);
    await log(`Cached task ${taskId} for ${user} - locked, loaded, and ready to rock! 🚀 Content present: ${!!content}`);
    return taskData;
  } catch (err) {
    await error(`Caching task ${task?.taskId || 'unknown'} for ${task?.user || 'unknown'} crashed: ${err.message} 🔥`);
    return null;
  }
}

/**
 * Retrieves all completed projects for a user from Redis.
 * @param {string} user - User identifier
 * @returns {Promise<Array>} List of completed projects
 */
export async function getCompletedProjects(user) {
  try {
    const projectKeys = await redisClient.keys(`project:${user}:*`);
    const projects = await Promise.all(
      projectKeys.map(async (key) => {
        const project = await get(key);
        return project && project.status === 'completed' ? project : null;
      })
    );
    const validProjects = projects
      .filter(p => p !== null)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    await log(`Fetched ${validProjects.length} epic projects for ${user} - ready to roll! 🎸`);
    return validProjects.map(project => ({
      text: `${project.name} (v${project.version}, ${project.type}) - "${project.features}"`,
      options: ["Refine Project", "Download", "Delete"],
      taskId: project.taskId,
      content: project.content,
      fileName: project.fileName,
    }));
  } catch (err) {
    await error(`Fetching projects for ${user} hit a snag: ${err.message} ⚠️`);
    return [];
  }
}

/**
 * Deletes a project from Redis.
 * @param {string} user - User identifier
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteProject(user, taskId) {
  try {
    const cacheKey = `project:${user}:${taskId}`;
    await del(cacheKey);
    await log(`Nuked project ${taskId} for ${user} from the vault - gone in a flash! 💥`);
    return true;
  } catch (err) {
    await error(`Deleting project ${taskId} for ${user} flopped: ${err.message} 🔥`);
    return false;
  }
}

/**
 * Retrieves the latest completed project for a user.
 * @param {string} user - User identifier
 * @returns {Promise<Object|null>} Latest project or null
 */
export async function getLatestProject(user) {
  try {
    const projects = await getCompletedProjects(user);
    const latest = projects.length > 0 ? projects[0] : null;
    if (latest) {
      await log(`Grabbed the latest banger "${latest.text}" for ${user} - hot off the press! 🌟`);
    } else {
      await log(`No projects yet for ${user} - time to build something epic! 🎤`);
    }
    return latest;
  } catch (err) {
    await error(`Fetching latest project for ${user} went sideways: ${err.message} ⚠️`);
    return null;
  }
}