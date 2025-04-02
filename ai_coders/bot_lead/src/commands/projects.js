// ai_coders/bot_lead/src/commands/projects.js (ESM, v2025-04-01-3)
/**
 * Projects Command Handler
 * Fetches and lists completed projects from Redis with cosmic flair and supernova precision.
 * Enhanced by xAI for compatibility with updated message emission.
 *
 * @version 2025-04-01-3
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/projects
 */

import { generateResponse } from '../aiHelper.js';
import { emitCosmicMessage } from '../stateManager.js'; // Replaced sendMessage with emitCosmicMessage
import { log, error } from '../logger.js';

/**
 * Lists a user’s completed projects with options for interaction.
 * @async
 * @function handleProjects
 * @param {Object} socket - Socket.IO instance (unused, kept for compatibility)
 * @param {string} userName - User requesting projects
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} [taskId] - Optional task ID
 * @param {string} userKey - Redis key for user info (unused here)
 * @param {string} stateKey - Redis key for task state (unused here)
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
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

    await log(`🌌 Fetched ${validProjects.length} cosmic projects for ${userName} (frontendId: ${frontendId})`);

    if (validProjects.length === 0) {
      const noProjectsMsg = await generateResponse(
        `Yo ${userName}, your cosmic vault’s a void! Let’s ignite some stellar creations—what’s your vibe? 🚀`,
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
        options: p.status === 'completed' ? ["Refine Project", "Download", "Delete"] : ["Refine Project"],
        projectData: {
          taskId: p.taskId,
          content: p.content,
          fileName: p.fileName || `${p.name}-v${p.version || 1}.zip`,
        },
      }));
      const projectsMsg = await generateResponse(
        `Behold, ${userName}! Your interstellar portfolio shines with ${validProjects.length} masterpiece${validProjects.length === 1 ? '' : 's'}:\n${projectList.map(p => `- ${p.text}`).join('\n')}`,
        userName,
        tone
      );
      await emitCosmicMessage({
        text: projectsMsg,
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
      `Yo ${userName}, project fetch hit a wormhole: ${err.message}. Retry or ping the cosmic crew! ⚠️`,
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
    await error(`💥 Projects fetch failed for ${userName} (frontendId: ${frontendId}): ${err.message}`);
  }
}