// ai_coders/bot_lead/src/taskCache.js
// Version: v2025-07-26-01
/**
 * Task Cache Module
 * Persists completed tasks and user data in Redis with cosmic durability and JSON consistency.
 * Enhanced by xAI for robust caching, project retrieval, and error resilience.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module taskCache
 */

import { log, error } from './logger.js';
import { set, get, sAdd, sMembers, del } from './redisClient.js';

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
 * Caches a completed task in Redis with cosmic permanence.
 * @async
 * @param {Object} projectData - Project data to cache
 * @param {string} projectData.taskId - Task ID
 * @param {string} projectData.frontendId - Frontend ID
 * @param {string} projectData.ip - Client IP
 * @param {string} projectData.name - Project name
 * @param {string} projectData.type - Project type
 * @param {string} projectData.fileName - File name
 * @param {string} projectData.content - Task content (base64)
 * @param {string} projectData.user - User name
 * @param {string} projectData.features - Project features
 * @param {number} projectData.version - Project version
 * @param {Object} projectData.jsonContent - Structured JSON content
 * @param {string} projectData.downloadLink - Download URL
 * @param {string} projectData.completedAt - Completion timestamp
 * @returns {Promise<Object|null>} Cached project or null on failure
 */
export async function cacheCompletedTask(projectData) {
  try {
    const {
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName,
      content,
      user,
      features,
      version,
      jsonContent,
      downloadLink,
      completedAt,
    } = projectData;

    const projectKey = `project:${user}:${taskId}`;
    const project = {
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName,
      content,
      user,
      features,
      version,
      jsonContent,
      downloadLink,
      timestamp: completedAt || new Date().toISOString(),
    };

    await set(projectKey, JSON.stringify(project));
    await sAdd(`completedProjects:${user}`, taskId);
    await log(`🌟 Project ${taskId} supernova-cached for ${user}: ${name} (type: ${type}, version: ${version})`, { taskId });
    return project;
  } catch (err) {
    await error(`Failed to cache project ${projectData.taskId} for ${projectData.user}: ${err.message}`, { taskId: projectData.taskId });
    return null;
  }
}

/**
 * Retrieves all completed project IDs for a user from Redis.
 * @async
 * @param {string} user - User name
 * @returns {Promise<string[]>} List of task IDs
 */
export async function getCompletedProjects(user) {
  try {
    const projectIds = await sMembers(`completedProjects:${user}`);
    const projects = [];
    for (const taskId of projectIds) {
      const projectKey = `project:${user}:${taskId}`;
      const projectData = await get(projectKey);
      if (projectData && isValidJSON(projectData)) {
        projects.push(taskId);
      } else if (projectData) {
        await del(projectKey);
        await log(`Cleared corrupted project data for ${projectKey}`);
      }
    }
    await log(`Fetched ${projects.length} supernova-charged projects for ${user}—cosmic archives unleashed! 🎸`, { user });
    return projects;
  } catch (err) {
    await error(`Failed to fetch projects for ${user}: ${err.message}`, { user });
    return [];
  }
}

/**
 * Sets the user name in Redis with stellar permanence and JSON consistency.
 * @async
 * @param {string} name - User name to cache
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<boolean>} Success status
 */
export async function setUserName(name, frontendId) {
  try {
    const userKey = `user:${frontendId}`;
    await set(userKey, JSON.stringify({ name }));
    await log(`Supernova identity "${name}" etched for frontend ${frontendId}—galactic records supernova-updated! ✨`);
    return true;
  } catch (err) {
    await error(`Setting user name "${name}" for frontend ${frontendId} supernova-failed: ${err.message} 🔥`);
    return false;
  }
}

/**
 * Retrieves the user name from Redis, handling corrupted data.
 * @async
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<string|null>} User name or null if not found
 */
export async function getUserName(frontendId) {
  try {
    const userKey = `user:${frontendId}`;
    const userData = await get(userKey);
    if (userData && isValidJSON(userData)) {
      const { name } = JSON.parse(userData);
      await log(`Retrieved user name "${name}" for frontend ${frontendId}—cosmic identity intact! 🌌`);
      return name;
    } else if (userData) {
      await del(userKey);
      await log(`Cleared corrupted user data for ${frontendId}`);
    }
    return null;
  } catch (err) {
    await error(`Failed to retrieve user name for frontend ${frontendId}: ${err.message}`);
    return null;
  }
}