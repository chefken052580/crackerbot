// ai_coders/bot_lead/src/redisUtils.js
import { redisClient, get } from './redisClient.js';
import { log } from './logger.js';

export async function getCompletedProjects(userName) {
  const projectKeys = await redisClient.keys(`project:${userName}:*`);
  const projects = await Promise.all(
    projectKeys.map(async (key) => {
      const project = await get(key);
      try {
        return project && project.completed ? project : null;
      } catch (e) {
        await log(`[ERROR] Failed to parse project ${key}: ${e.message}`);
        return null;
      }
    })
  );
  return projects.filter(p => p !== null);
}

export async function getLatestProject(userName) {
  const projects = await getCompletedProjects(userName);
  if (!projects.length) return null;
  return projects.sort((a, b) => parseInt(b.taskId) - parseInt(a.taskId))[0];
}