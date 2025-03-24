// ai_coders/bot_lead/src/taskCache.js
import { log, error } from './logger.js';
import { set, get, del } from './redisClient.js'; // Only import exported functions
import { redisClient } from './redisClient.js'; // Import redisClient for keys method

// Cache a completed task in Redis
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
      completed: true,
      timestamp: new Date().toISOString(),
    };
    await set(cacheKey, taskData);
    await log(`Cached task ${taskId} for ${user} - locked, loaded, and ready to rock! 🚀`);
    return taskData;
  } catch (err) {
    await error(`Caching task ${task.taskId} for ${user} crashed and burned: ${err.message} 🔥`);
    throw err;
  }
}

// Fetch all completed projects for a user
export async function getCompletedProjects(user) {
  try {
    const projectKeys = await redisClient.keys(`project:${user}:*`); // Use redisClient.keys directly
    const projects = await Promise.all(
      projectKeys.map(async (key) => {
        const project = await get(key);
        return project && project.completed ? project : null;
      })
    );
    const validProjects = projects.filter(p => p !== null).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

// Delete a cached project
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

// Get the latest completed project for a user
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