// ai_coders/bot_lead/src/commands/guide.js (ESM, v2025-03-28-1)
/**
 * Guide Command Handler
 * Displays the list of available commands with Matrix-green flair.
 *
 * @version 2025-03-28-1
 * @author CrackerBot Team, enhanced by xAI
 */

import { generateResponse } from '../aiHelper.js';
import { sendMessage } from '../taskHandlers.js';
import { getCommandList } from './index.js';
import { log, error } from '../logger.js';

/**
 * Shows the command guide.
 * @param {Object} socket - Socket.IO instance.
 * @param {string} userName - User requesting guide.
 * @param {string} tone - Response tone.
 * @param {string} ip - User IP.
 * @param {string} frontendId - Frontend ID.
 * @param {string} taskId - Optional task ID.
 * @param {string} userKey - Redis key for user info.
 * @param {string} stateKey - Redis key for task state.
 * @param {Object} redisClient - Redis client instance.
 */
export default async function handleGuide(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient) {
  try {
    const commandList = getCommandList();
    const commandsText = Object.entries(commandList)
      .map(([cmd, desc]) => `/${cmd}: ${desc}`)
      .join('\n');
    const guideMsg = await generateResponse(
      `Yo ${userName}, here’s the cosmic command codex—Matrix-green and ready to roll:\n${commandsText}`,
      userName,
      tone
    );
    await sendMessage(socket, {
      text: guideMsg,
      type: 'success',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    await log(`Displayed guide for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, guide fetch glitched: ${err.message}. Retry or holler! ⚠️`,
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
    await error(`Guide fetch failed for ${userName}: ${err.message}`);
  }
}