// ai_coders/bot_lead/src/commands/reset_name.js
// Version: v2025-07-29-04
/**
 * Reset Name Command Handler
 * Resets the user’s name and prompts for a new one with retro-cosmic flair.
 * Enhanced by xAI for robust message emission, deduplication, alignment with taskHandlers.js,
 * and sessionKey clearing.
 *
 * @version 2025-07-29-04
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/reset_name
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js'; // Use sendMessage directly
import { log, error } from '../logger.js';
import { redisClient, set, del } from '../redisClient.js';

/**
 * Resets the user’s name and prompts for a new cosmic identity.
 * @async
 * @function handleResetName
 * @param {Object} socket - Socket.IO instance
 * @param {string} userName - Current user name
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} taskId - Task ID
 * @param {string} userKey - Redis key for user info
 * @param {string} stateKey - Redis key for task state
 * @param {string} sessionId - Session ID
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
export default async function handleResetName(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, sessionId, redisClient) {
  try {
    const welcomeKey = `welcomeSent:${frontendId}`;
    const sessionKey = `session:${sessionId}`;
    const sessionLockKey = `sessionLock:${frontendId}`;

    // Clear user and state data
    await redisClient.del(userKey);
    await redisClient.del(stateKey);
    await redisClient.del(welcomeKey);
    await redisClient.del(sessionKey);
    await redisClient.del(sessionLockKey);

    // Set new state
    const newTaskId = `initial:${frontendId}`;
    await set(stateKey, JSON.stringify({ step: 'name', taskId: newTaskId, user: 'Guest' }));
    await set(sessionKey, JSON.stringify({ step: 'name', taskId: newTaskId, user: 'Guest' }));

    const resetMsg = await generateResponse(
      `🌌 Cosmic channels realigned, ${userName}! Your old identity’s been zapped—choose a new alias to reclaim your galactic legacy! 🚀`,
      'Guest',
      tone,
      { taskId: newTaskId }
    );

    await sendMessage(socket, {
      text: resetMsg,
      type: 'question',
      taskId: newTaskId,
      from: 'CrackerBot Prime',
      target: 'frontend',
      ip,
      user: 'Guest',
      frontendId,
      options: ['Type your name below!'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
      messageId: `welcome-Guest-${newTaskId}-${Date.now()}`,
    });

    await log(`🌌 Reset cosmic identity for ${userName} (frontendId: ${frontendId}, taskId: ${newTaskId})`, { frontendId, taskId: newTaskId });
  } catch (err) {
    const errorMsg = await generateResponse(
      `Cosmic static, ${userName}! Reset failed: ${err.message}. Retry or hail the cosmic crew! ⚠️`,
      userName,
      tone,
      { taskId }
    );
    await sendMessage(socket, {
      text: errorMsg,
      type: 'error',
      taskId: taskId || `error:${Date.now()}`,
      from: 'CrackerBot Prime',
      target: 'frontend',
      ip,
      user: userName,
      frontendId,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `error-${Date.now()}`,
    });
    await error(`💥 Reset name failed for ${userName} (frontendId: ${frontendId}): ${err.message}`, { frontendId, taskId });
  }
}