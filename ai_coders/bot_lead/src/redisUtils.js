// ai_coders/bot_lead/src/redisUtils.js (ESM, v2025-03-28-1)
/* CrackerBot’s Redis utilities—fetching cosmic project data with flair! 🌌 */
import { redisClient, get } from './redisClient.js';
import { log } from './logger.js';

export async function getCompletedProjects(userName) {
  const projectKeys = await redisClient.keys(`project:${userName}:*`);
  const projects = await Promise.all(
    projectKeys.map(async (key) => {
      const project = await get(key);
      if (!project || typeof project !== 'object') {
        await log(`[WARN] Invalid project data at ${key}: ${JSON.stringify(project).slice(0, 50)}...`);
        return null;
      }
      return project.completed ? project : null;
    })
  );
  const validProjects = projects.filter(p => p !== null);
  if (validProjects.length < projectKeys.length) {
    await log(`[INFO] Filtered ${projectKeys.length - validProjects.length} corrupted/invalid projects for ${userName}`);
  }
  return validProjects.map(p => p.taskId);
}

export async function getLatestProject(userName) {
  const projects = await getCompletedProjects(userName);
  if (!projects.length) return null;
  const fullProjects = await Promise.all(projects.map(async (taskId) => await get(`project:${userName}:${taskId}`)));
  return fullProjects.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
}