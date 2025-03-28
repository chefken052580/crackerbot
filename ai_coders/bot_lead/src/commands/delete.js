// ai_coders/bot_lead/src/commands/delete.js (ESM, v2025-03-28-2)
/**
 * Delete Command Handler
 * Deletes a project from Redis by taskId with cosmic flair.
 *
 * @version 2025-03-28-2
 * @author CrackerBot Team, enhanced by xAI
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js';
import { log, error } from '../logger.js';

/**
 * Deletes a project by taskId.
 * @param {Object} socket - Socket.IO instance.
 * @param {string} userName - User requesting deletion.
 * @param {string} tone - Response tone.
 * @param {string} ip - User IP.
 * @param {string} frontendId - Frontend ID.
 * @param {string} taskId - Task ID from message (optional).
 * @param {string} userKey - Redis key for user info.
 * @param {string} stateKey - Redis key for task state.
 * @param {Object} redisClient - Redis client instance.
 * @param {string} [args] - Additional args from command (e.g., taskId).
 */
export default async function handleDelete(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient, args) {
  try {
    const targetTaskId = args || taskId; // Use args if provided, else taskId
    if (!targetTaskId) {
      const errorMsg = await generateResponse(
        `Yo ${userName}, gotta pick a target to blast! Use /delete <taskId>—check /projects for IDs. 💥`,
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
      return;
    }

    const projectKey = `project:${userName}:${targetTaskId}`;
    const exists = await redisClient.exists(projectKey);
    if (!exists) {
      const errorMsg = await generateResponse(
        `Yo ${userName}, "${targetTaskId}" ain’t in the vault! Scope /projects for real targets. 🌌`,
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
      return;
    }

    await redisClient.del(projectKey);
    await redisClient.sRem(`completedProjects:${userName}`, targetTaskId);
    await redisClient.hDel('tasks', targetTaskId);
    const successMsg = await generateResponse(
      `Boom, ${userName}! "${targetTaskId}" got zapped from the cosmos—what’s next? 🚀`,
      userName,
      tone
    );
    await sendMessage(socket, {
      text: successMsg,
      type: 'success',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      options: ["Chat", "Build-Something-Epic"],
    });
    await log(`Deleted project ${targetTaskId} for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, delete hit a snag: ${err.message}. Retry or shout! ⚠️`,
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
    await error(`Delete failed for ${userName} on task ${taskId || args}: ${err.message}`);
  }
}