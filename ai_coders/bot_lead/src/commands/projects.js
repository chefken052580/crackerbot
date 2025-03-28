// ai_coders/bot_lead/src/commands/projects.js (ESM, v2025-03-28-2)
/**
 * Projects Command Handler
 * Fetches and lists completed projects from Redis with cosmic flair.
 *
 * @version 2025-03-28-2
 * @author CrackerBot Team, enhanced by xAI
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js';
import { log, error } from '../logger.js';

/**
 * Lists user’s completed projects.
 * @param {Object} socket - Socket.IO instance.
 * @param {string} userName - User requesting projects.
 * @param {string} tone - Response tone.
 * @param {string} ip - User IP.
 * @param {string} frontendId - Frontend ID.
 * @param {string} taskId - Optional task ID.
 * @param {string} userKey - Redis key for user info.
 * @param {string} stateKey - Redis key for task state.
 * @param {Object} redisClient - Redis client instance.
 */
export default async function handleProjects(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    // Fetch projects directly from Redis
    const projectKeys = await redisClient.keys(`project:${userName}:*`);
    const projects = await Promise.all(
      projectKeys.map(async (key) => {
        const projectData = await redisClient.get(key);
        return projectData ? JSON.parse(projectData) : null;
      })
    );
    const validProjects = projects.filter((p) => p && p.taskId);

    await log(`Fetched ${validProjects.length} projects for ${userName} (frontendId: ${frontendId})`);

    if (validProjects.length === 0) {
      const noProjectsMsg = await generateResponse(
        `Yo ${userName}, your project vault’s empty! Let’s craft something stellar—what’s your vibe? 🚀`,
        userName,
        tone
      );
      await sendMessage(socket, {
        text: noProjectsMsg,
        type: 'success',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        options: ["Chat", "Build-Something-Epic"],
      });
    } else {
      const projectList = validProjects.map(p => ({
        text: `${p.name} (v${p.version || 1}) - ${p.type} (${p.features || 'No features yet'})`,
        taskId: p.taskId,
        options: p.status === 'completed' ? ["Refine Project", "Download", "Delete"] : ["Refine Project"],
        projectData: {
          taskId: p.taskId,
          content: p.content,
          fileName: p.fileName || `${p.name}-v${p.version || 1}.zip`,
        },
      }));
      const projectsMsg = await generateResponse(
        `Check it, ${userName}! Your interstellar portfolio has ${validProjects.length} masterpiece${validProjects.length === 1 ? '' : 's'}:\n${projectList.map(p => `- ${p.text}`).join('\n')}`,
        userName,
        tone
      );
      await sendMessage(socket, {
        text: projectsMsg,
        type: 'success',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        projects: projectList,
      });
    }
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, project fetch hit a wormhole: ${err.message}. Retry or ping for help! ⚠️`,
      userName,
      tone
    );
    await sendMessage(socket, {
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    await error(`Projects fetch failed for ${userName}: ${err.message}`);
  }
}