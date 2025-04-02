// ai_coders/bot_lead/src/commands/delete.js (ESM, v2025-04-01-3)
/**
 * Delete Command Handler
 * Deletes a project from Redis by taskId with cosmic flair and supernova precision.
 * Enhanced by xAI for updated message emission and stellar styling.
 *
 * @version 2025-04-01-3
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/delete
 */

import { generateResponse } from '../aiHelper.js';
import { emitCosmicMessage } from '../stateManager.js'; // Replaced sendMessage
import { log, error } from '../logger.js';

/**
 * Deletes a project by taskId with cosmic precision.
 * @async
 * @function handleDelete
 * @param {Object} socket - Socket.IO instance (unused, kept for compatibility)
 * @param {string} userName - User requesting deletion
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} [taskId] - Task ID from message (optional)
 * @param {string} userKey - Redis key for user info (unused here)
 * @param {string} stateKey - Redis key for task state (unused here)
 * @param {Object} redisClient - Redis client instance
 * @param {string} [args] - Additional args from command (e.g., taskId)
 * @returns {Promise<void>}
 */
export default async function handleDelete(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient, args) {
  try {
    const targetTaskId = args || taskId; // Use args if provided, else taskId
    if (!targetTaskId) {
      const errorMsg = await generateResponse(
        `Yo ${userName}, gotta aim the cosmic blaster! Use /delete <taskId>—check /projects for targets. 💥`,
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
      return;
    }

    const projectKey = `project:${userName}:${targetTaskId}`;
    const exists = await redisClient.exists(projectKey);
    if (!exists) {
      const errorMsg = await generateResponse(
        `Yo ${userName}, "${targetTaskId}" ain’t in the cosmic vault! Scope /projects for real targets. 🌌`,
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
      return;
    }

    await redisClient.del(projectKey);
    await redisClient.sRem(`completedProjects:${userName}`, targetTaskId);
    await redisClient.hDel('tasks', targetTaskId);
    const successMsg = await generateResponse(
      `Boom, ${userName}! "${targetTaskId}" vaporized from the cosmos—what’s your next move, star commander? 🚀`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: successMsg,
      type: 'success',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      options: ["Chat", "Build-Something-Epic"],
      bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000', animation: 'glow 1.5s infinite' },
    });
    await log(`🌌 Obliterated project ${targetTaskId} for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, delete beam misfired: ${err.message}. Retry or summon cosmic support! ⚠️`,
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
    await error(`💥 Delete failed for ${userName} on task ${taskId || args} (frontendId: ${frontendId}): ${err.message}`);
  }
}