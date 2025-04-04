// ai_coders/bot_lead/src/commands/index.js (ESM, v2025-04-02-08)
/**
 * Command Orchestrator Module
 * Central hub for CrackerBot’s command galaxy, routing inputs to handlers with interstellar flair.
 * Powers real-time WebSocket vibes and Redis persistence for project mastery.
 * Enhanced by xAI for cosmic message emission and stellar integration.
 *
 * @version 2025-04-02-08
 * @author CrackerBot Team, enhanced by xAI
 * @module commands/index
 */

import projects from './projects.js';
import download from './download.js';
import resetName from './reset_name.js';
import guide from './guide.js';
import deleteCommand from './delete.js';
import { emitCosmicMessage } from '../stateManager.js';
import { log, error, warn } from '../logger.js';

const commands = {
  projects: {
    handler: projects,
    description: '📋 Unveils your project constellation with Refine, Download, Delete options.',
  },
  download: {
    handler: download,
    description: '📥 Beams your projects down as a sleek alias to /projects.',
  },
  reset_name: {
    handler: resetName,
    description: '🔄 Resets your username with a retro rewind.',
  },
  guide: {
    handler: guide,
    description: '📖 Drops a Matrix-green command codex.',
  },
  delete: {
    handler: deleteCommand,
    description: '🗑️ Zaps a project from Redis by taskId with cosmic flair.',
  },
};

/**
 * Executes a command with WebSocket and Redis integration.
 * Routes with style, logs every move, and handles errors like a galactic pro.
 * @async
 * @param {Object} socket - Socket.IO instance for real-time comms
 * @param {Object} data - Command data
 * @param {string} data.command - Command name
 * @param {string} data.frontendId - Frontend identifier
 * @param {string} data.user - User name
 * @param {string} [data.tone] - Response tone
 * @param {string} [data.ip] - Client IP
 * @param {string} [data.taskId] - Task ID
 * @param {string} [data.userKey] - Redis key for user info
 * @param {string} [data.stateKey] - Redis key for task state
 * @param {string} [data.args] - Command arguments
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
export async function executeCommand(socket, data, redisClient) {
  const {
    command,
    frontendId,
    user: userName,
    tone = 'DEFAULT_TONE',
    ip = 'unknown',
    taskId,
    userKey = `user:${frontendId}`,
    stateKey = `taskState:${frontendId}`,
    args,
  } = data;
  const cmd = command.toLowerCase();
  const commandEntry = commands[cmd];

  if (!commandEntry) {
    const errorMsg = {
      text: `Yo ${userName}, "${command}" isn’t charted in our galaxy yet! Try /guide for the cosmic map. 🌌`,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    };
    await emitCosmicMessage(errorMsg, socket);
    await warn(`🌠 Unknown command "${command}" from ${userName} (frontendId: ${frontendId})`);
    return;
  }

  try {
    await log(`🚀 Launching "${cmd}" for ${userName} (frontendId: ${frontendId}, taskId: ${taskId || 'none'})`);
    await commandEntry.handler(socket, userName, tone, ip, frontendId, taskId, userKey, stateKey, redisClient, args);
    await log(`🌟 Command "${cmd}" completed for ${userName} (frontendId: ${frontendId})`);
  } catch (err) {
    const errorMsg = {
      text: `Whoa, ${userName}! "${cmd}" hit a supernova snag: ${err.message}. Retry or check /guide! 🌠`,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    };
    await emitCosmicMessage(errorMsg, socket);
    await error(`💥 Command "${cmd}" failed for ${userName} (frontendId: ${frontendId}): ${err.message}`);
  }
}

/**
 * Returns the list of available commands with descriptions.
 * @returns {Object} Command name to description mapping
 */
export function getCommandList() {
  return Object.fromEntries(
    Object.entries(commands).map(([name, { description }]) => [name, description])
  );
}

// Ignition with cosmic flair
(async () => {
  await log('🌌 Command orchestrator online with ESM power and supernova vibes!');
})();