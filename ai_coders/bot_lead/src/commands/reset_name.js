// ai_coders/bot_lead/src/commands/reset_name.js (ESM, v2025-03-28-1)
/**
 * Reset Name Command Handler
 * Resets the user’s name and prompts for a new one with retro flair.
 *
 * @version 2025-03-28-1
 * @author CrackerBot Team, enhanced by xAI
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js';
import { log, error } from '../logger.js';

/**
 * Resets the user’s name and prompts for a new one.
 * @param {Object} socket - Socket.IO instance.
 * @param {string} userName - Current user name.
 * @param {string} tone - Response tone.
 * @param {string} ip - User IP.
 * @param {string} frontendId - Frontend ID.
 * @param {string} taskId - Optional task ID.
 * @param {string} userKey - Redis key for user info.
 * @param {string} stateKey - Redis key for task state.
 * @param {Object} redisClient - Redis client instance.
 */
export default async function handleResetName(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    await redisClient.del(userKey);
    await redisClient.set(stateKey, JSON.stringify({ step: 'name', taskId: `initial_name:${frontendId}` }));
    const resetMsg = await generateResponse(
      `Yo ${userName}, your cosmic tag’s been wiped! Drop a fresh alias to reboot the vibe! 🌟`,
      userName,
      tone
    );
    await sendMessage(socket, {
      text: resetMsg,
      type: 'question',
      taskId: `initial_name:${frontendId}`,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: 'Guest', // Reset to Guest until new name is provided
      frontendId,
      options: ["Type your name below!"],
    });
    await log(`Reset name for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, reset hit a glitch: ${err.message}. Try again or shout! ⚠️`,
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
    await error(`Reset name failed for ${userName}: ${err.message}`);
  }
}