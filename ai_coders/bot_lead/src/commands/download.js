// ai_coders/bot_lead/src/commands/download.js (ESM, v2025-03-28-1)
/**
 * Download Command Handler
 * Alias to /projects, lists projects for download with cosmic flair.
 *
 * @version 2025-03-28-1
 * @author CrackerBot Team, enhanced by xAI
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js';
import { log, error } from '../logger.js';

/**
 * Lists user’s completed projects for download.
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
export default async function handleDownload(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    const projectKeys = await redisClient.keys(`project:${userName}:*`);
    const projects = await Promise.all(
      projectKeys.map(async (key) => {
        const projectData = await redisClient.get(key);
        return projectData ? JSON.parse(projectData) : null;
      })
    );
    const validProjects = projects.filter((p) => p && p.taskId && p.content);

    await log(`Fetched ${validProjects.length} downloadable projects for ${userName} (frontendId: ${frontendId})`);

    if (validProjects.length === 0) {
      const noProjectsMsg = await generateResponse(
        `Yo ${userName}, no projects ready to beam down! Build something epic first! 🚀`,
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
        options: ["Download"], // Only Download option
        projectData: {
          taskId: p.taskId,
          content: p.content,
          fileName: p.fileName || `${p.name}-v${p.version || 1}.zip`,
        },
      }));
      const downloadMsg = await generateResponse(
        `Yo ${userName}, your download-ready stash:\n${projectList.map(p => `- ${p.text}`).join('\n')}`,
        userName,
        tone
      );
      await sendMessage(socket, {
        text: downloadMsg,
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
      `Yo ${userName}, download fetch hit a snag: ${err.message}. Retry or holler! ⚠️`,
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
    await error(`Download fetch failed for ${userName}: ${err.message}`);
  }
}