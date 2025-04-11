// ai_coders/bot_lead/src/taskCache.js (ESM, v2025-04-11-07)
/**
 * CrackerBot’s Cosmic Vault Module
 * Caches completed tasks and manages user data with interstellar precision and galactic flair!
 * Enhanced by xAI for JSON consistency with redisClient, jsonContent support, and supernova robustness.
 *
 * @version 2025-04-11-07
 * @author CrackerBot Team, enhanced by xAI
 */

import { log, error } from './logger.js';
import { set, get, del } from './redisClient.js';
import { redisClient } from './redisClient.js';

/**
 * Caches a completed task in Redis with supernova brilliance, including jsonContent.
 * @param {Object} task - Task data to cache
 * @param {string} task.taskId - Unique task identifier
 * @param {string} task.frontendId - Frontend identifier
 * @param {string} task.ip - Client IP
 * @param {string} task.name - Project name
 * @param {string} task.type - Project type
 * @param {string} task.fileName - File name
 * @param {string} task.content - Task content (base64)
 * @param {string} task.user - User name
 * @param {string} [task.features] - Project features
 * @param {number} [task.version] - Version number
 * @param {string|null} [task.network] - Network (optional)
 * @param {Object} [task.jsonContent] - Structured JSON content from taskExecution
 * @returns {Promise<Object|null>} Cached task data or null on failure
 */
export async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, ip, name, type, fileName, content, user, features, version, network, jsonContent } = task;
    if (!taskId || !user) {
      throw new Error('Missing taskId or user—cosmic coordinates scrambled!');
    }

    const cacheKey = `project:${user}:${taskId}`;
    const taskData = {
      taskId,
      frontendId: frontendId || 'unknown',
      ip: ip || 'unknown',
      name: name || 'unnamed_project',
      type: type || 'unknown',
      fileName: fileName || `${name || 'project'}_v${version || 1}.zip`,
      content: content || null,
      user,
      features: features || 'basic functionality',
      version: version || 1,
      network: network || null,
      status: 'completed',
      timestamp: new Date().toISOString(),
      jsonContent: jsonContent || { files: { 'readme.txt': { content: 'Cosmic essence captured!', encoding: 'utf8' } } }, // Default if missing
    };
    await set(cacheKey, taskData); // Store as object, JSON handled by redisClient
    await log(`Task ${taskId} for ${user} supernova-sealed in the cosmic vault—ready for galactic retrieval! 🌌 Content: ${!!content ? 'Stellar payload included!' : 'No payload, pure essence!'} JSON: ${Object.keys(taskData.jsonContent.files).length} files`, { taskId });
    return taskData;
  } catch (err) {
    await error(`Caching task ${task?.taskId || 'unknown'} for ${task?.user || 'unknown'} supernova-imploded: ${err.message} 🔥`);
    return null;
  }
}

/**
 * Retrieves all completed projects for a user from Redis with cosmic sorting.
 * @param {string} user - User identifier
 * @returns {Promise<Array>} List of completed projects formatted for UI
 */
export async function getCompletedProjects(user) {
  try {
    const projectKeys = await redisClient.keys(`project:${user}:*`);
    const projects = await Promise.all(
      projectKeys.map(async (key) => {
        const project = await get(key);
        return project; // Already parsed by redisClient
      })
    );
    const validProjects = projects
      .filter(p => p !== null && p.status === 'completed')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    await log(`Fetched ${validProjects.length} supernova-charged projects for ${user}—cosmic archives unleashed! 🎸`);
    return validProjects.map(project => ({
      text: `${project.name} (v${project.version}, ${project.type}) - "${project.features}"`,
      options: ["Refine Project", "Download", "Delete"],
      taskId: project.taskId,
      content: project.content,
      fileName: project.fileName,
      projectData: project, // Include full project data for UI rendering
    }));
  } catch (err) {
    await error(`Fetching projects for ${user} hit a cosmic black hole: ${err.message} ⚠️`);
    return [];
  }
}

/**
 * Deletes a project from Redis with cosmic precision.
 * @param {string} user - User identifier
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteProject(user, taskId) {
  try {
    const cacheKey = `project:${user}:${taskId}`;
    await del(cacheKey);
    await log(`Project ${taskId} for ${user} supernova-vaporized from the vault—cosmic dust remains! 💥`);
    return true;
  } catch (err) {
    await error(`Deleting project ${taskId} for ${user} supernova-fizzled: ${err.message} 🔥`);
    return false;
  }
}

/**
 * Retrieves the latest completed project for a user with galactic flair.
 * @param {string} user - User identifier
 * @returns {Promise<Object|null>} Latest project or null if none exist
 */
export async function getLatestProject(user) {
  try {
    const projects = await getCompletedProjects(user);
    const latest = projects.length > 0 ? projects[0] : null;
    if (latest) {
      await log(`Snagged the freshest supernova gem "${latest.text}" for ${user}—hot from the starforge! 🌟`);
    } else {
      await log(`No projects yet for ${user}—the galaxy awaits your first cosmic masterpiece! 🎤`);
    }
    return latest;
  } catch (err) {
    await error(`Fetching latest project for ${user} warped out: ${err.message} ⚠️`);
    return null;
  }
}

/**
 * Retrieves the cached user name for a frontend ID.
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<string|null>} User name or null if not found
 */
export async function getUserName(frontendId) {
  try {
    const userKey = `user:${frontendId}`;
    const userData = await get(userKey);
    const userName = userData?.name || null;
    if (userName) {
      await log(`Retrieved supernova-charged identity "${userName}" for frontend ${frontendId}—star traveler confirmed! 🌌`);
      return userName;
    }
    await log(`No name found for frontend ${frontendId}—a mysterious cosmic voyager emerges! 👤`);
    return null;
  } catch (err) {
    await error(`Fetching user name for frontend ${frontendId} supernova-crashed: ${err.message} ⚠️`);
    return null;
  }
}

/**
 * Sets the user name in Redis with stellar permanence and JSON consistency.
 * @param {string} name - User name to cache
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<boolean>} Success status
 */
export async function setUserName(name, frontendId) {
  try {
    const userKey = `user:${frontendId}`;
    const userData = { name }; // Object for JSON consistency
    await set(userKey, userData); // Store as object, JSON handled by redisClient
    await log(`Supernova identity "${name}" etched for frontend ${frontendId}—galactic records supernova-updated! ✨`);
    return true;
  } catch (err) {
    await error(`Setting user name "${name}" for frontend ${frontendId} supernova-failed: ${err.message} 🔥`);
    return false;
  }
}

/**
 * Retrieves the count of completed projects for a user.
 * @param {string} user - User identifier
 * @returns {Promise<number>} Number of completed projects
 */
export async function getProjectCount(user) {
  try {
    const projects = await getCompletedProjects(user);
    await log(`Counted ${projects.length} supernova creations for ${user}—stellar tally supernova-complete! 🚀`);
    return projects.length;
  } catch (err) {
    await error(`Counting projects for ${user} hit a cosmic snag: ${err.message} ⚠️`);
    return 0;
  }
}