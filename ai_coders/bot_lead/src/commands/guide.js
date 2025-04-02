// ai_coders/bot_lead/src/commands/guide.js (ESM, v2025-04-01-2)
/**
 * Guide Command Handler
 * Displays the list of available commands with Matrix-green cosmic flair.
 * Enhanced by xAI for updated message emission and stellar styling.
 *
 * @version 2025-04-01-2
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/guide
 */

import { generateResponse } from '../aiHelper.js';
import { emitCosmicMessage } from '../stateManager.js'; // Replaced sendMessage
import { getCommandList } from './index.js';
import { log, error } from '../logger.js';

/**
 * Shows the cosmic command guide with style and precision.
 * @async
 * @function handleGuide
 * @param {Object} socket - Socket.IO instance (unused, kept for compatibility)
 * @param {string} userName - User requesting the guide
 * @param {string} tone - Response tone
 * @param {string} ip - User IP
 * @param {string} frontendId - Unique frontend identifier
 * @param {string} [taskId] - Optional task ID
 * @param {string} userKey - Redis key for user info (unused here)
 * @param {string} stateKey - Redis key for task state (unused here)
 * @param {Object} redisClient - Redis client instance (unused here)
 * @returns {Promise<void>}
 */
export default async function handleGuide(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    const commandList = getCommandList();
    const commandsText = Object.entries(commandList)
      .map(([cmd, desc]) => `/${cmd}: ${desc}`)
      .join('\n');
    const guideMsg = await generateResponse(
      `Yo ${userName}, behold the cosmic command codex—etched in Matrix-green stardust:\n${commandsText}`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: guideMsg,
      type: 'success',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #00ff85, #00cc00)', color: '#000', animation: 'glow 1.5s infinite' }, // Matrix-green flair
    });
    await log(`🌌 Unveiled the cosmic guide for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, the guide warped into a glitch: ${err.message}. Retry or summon cosmic aid! ⚠️`,
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
    await error(`💥 Guide fetch failed for ${userName} (frontendId: ${frontendId}): ${err.message}`);
  }
}