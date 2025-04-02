// ai_coders/bot_lead/src/commands/download.js (ESM, v2025-04-01-2)
/**
 * Download Command Handler
 * Alias to /projects, lists projects for download with cosmic flair.
 * Enhanced by xAI for updated message emission and stellar styling.
 *
 * @version 2025-04-01-2
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/download
 */

import { generateResponse } from '../aiHelper.js';
import { emitCosmicMessage } from '../stateManager.js'; // Replaced sendMessage
import { log, error } from '../logger.js';

/**
 * Lists user’s completed projects for download with cosmic precision.
 * @async
 * @function handleDownload
 * @param {Object} socket - Socket.IO instance (unused, kept for compatibility)
 * @param {string} userName - User requesting downloads
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} [taskId] - Optional task ID
 * @param {string} userKey - Redis key for user info (unused here)
 * @param {string} stateKey - Redis key for task state (unused here)
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
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

    await log(`🌌 Fetched ${validProjects.length} downloadable cosmic artifacts for ${userName} (frontendId: ${frontendId})`);

    if (validProjects.length === 0) {
      const noProjectsMsg = await generateResponse(
        `Yo ${userName}, your cosmic stash is empty! Forge some epic loot to beam down! 🚀`,
        userName,
        tone
      );
      await emitCosmicMessage({
        text: noProjectsMsg,
        type: 'success',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        options: ["Chat", "Build-Something-Epic"],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff', animation: 'pulse 2s infinite' },
      });
    } else {
      const projectList = validProjects.map(p => ({
        text: `${p.name} (v${p.version || 1}) - ${p.type} (${p.features || 'No features yet'})`,
        taskId: p.taskId,
        options: ["Download"],
        projectData: {
          taskId: p.taskId,
          content: p.content,
          fileName: p.fileName || `${p.name}-v${p.version || 1}.zip`,
        },
      }));
      const downloadMsg = await generateResponse(
        `Yo ${userName}, your cosmic vault is loaded! ${validProjects.length} stellar download${validProjects.length === 1 ? '' : 's'} ready:\n${projectList.map(p => `- ${p.text}`).join('\n')}`,
        userName,
        tone
      );
      await emitCosmicMessage({
        text: downloadMsg,
        type: 'success',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        projects: projectList,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000', animation: 'glow 1.5s infinite' },
      });
    }
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, the download beam misfired: ${err.message}. Retry or summon cosmic aid! ⚠️`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    });
    await error(`💥 Download fetch failed for ${userName} (frontendId: ${frontendId}): ${err.message}`);
  }
}