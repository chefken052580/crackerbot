// ai_coders/bot_lead/src/commands/reset_name.js (ESM, v2025-04-01-2)
/**
 * Reset Name Command Handler
 * Resets the user’s name and prompts for a new one with retro-cosmic flair.
 * Enhanced by xAI for updated message emission and stellar styling.
 *
 * @version 2025-04-01-2
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/reset_name
 */

import { generateResponse } from '../aiHelper.js';
import { emitCosmicMessage } from '../stateManager.js'; // Replaced sendMessage
import { log, error } from '../logger.js';

/**
 * Resets the user’s name and prompts for a new cosmic identity.
 * @async
 * @function handleResetName
 * @param {Object} socket - Socket.IO instance (unused, kept for compatibility)
 * @param {string} userName - Current user name
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} [taskId] - Optional task ID
 * @param {string} userKey - Redis key for user info
 * @param {string} stateKey - Redis key for task state
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
export default async function handleResetName(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    await redisClient.del(userKey);
    await redisClient.set(stateKey, JSON.stringify({ step: 'name', taskId: `initial_name:${frontendId}` }));
    const resetMsg = await generateResponse(
      `Yo ${userName}, your cosmic ID’s been zapped back to the retro grid! Drop a fresh alias to reboot your galactic vibe! 🌟`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: resetMsg,
      type: 'question',
      taskId: `initial_name:${frontendId}`,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: 'Guest', // Reset to Guest until new name is provided
      frontendId,
      options: ["Type your name below!"],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #00ff85)', color: '#000', animation: 'pulse 2s infinite' }, // Retro flair
    });
    await log(`🌌 Reset cosmic identity for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, the reset beam flickered: ${err.message}. Retry or hail the cosmic crew! ⚠️`,
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
    await error(`💥 Reset name failed for ${userName} (frontendId: ${frontendId}): ${err.message}`);
  }
}