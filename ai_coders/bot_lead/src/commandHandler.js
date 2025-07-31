// bot_lead/src/commandHandler.js
// Version: v2025-07-20-08
/**
 * Command Handler Module
 * Processes CrackerBot’s cosmic commands with supernova precision.
 * Enhanced by xAI for robust Redis integration and project management.
 *
 * @version 2025-07-20-08
 * @author CrackerBot Team, enhanced by xAI
 * @module commandHandler
 */

import { log, error } from './logger.js';
import { getCompletedProjects, setUserName, getUserName } from './taskCache.js';
import { sendMessage } from './taskHandlers.js';
import { botSocket } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import { del } from './redisClient.js';

/**
 * Executes a command with cosmic flair.
 * @async
 * @param {Object} socket - WebSocket instance
 * @param {Object} data - Command data
 * @param {string} data.command - Command name
 * @param {string} data.frontendId - Frontend ID
 * @param {string} data.user - User name
 * @param {string} data.tone - Response tone
 * @param {string} data.ip - Client IP
 * @param {string} data.taskId - Task ID
 * @param {string} data.userKey - Redis user key
 * @param {string} data.stateKey - Redis task state key
 * @param {string} data.args - Command arguments
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
export async function executeCommand(socket, { command, frontendId, user, tone, ip, taskId, userKey, stateKey, args }, redisClient) {
  try {
    switch (command.toLowerCase()) {
      case 'commands':
        const commandList = [
          '/commands - List all cosmic commands',
          '/projects - View your stellar creations',
          '/clear_cache - Purge cosmic archives',
          '/reset_all - Realign to a fresh galaxy',
          '/delete <taskId> - Vaporize a project',
          '/restart - Restart a task',
          '/store_project - Store a completed project'
        ].join('\n');
        const commandsMsg = await generateResponse(
          `🌟 Cosmic Command Codex:\n${commandList}`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: commandsMsg,
          type: 'system',
          taskId,
          ip,
          user,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#333' },
          messageId: `${taskId}-commands`,
        });
        await log(`Displayed command codex for ${user} (ID: ${frontendId})`, { taskId });
        break;

      case 'projects':
        const projectIds = await getCompletedProjects(user);
        if (projectIds.length === 0) {
          const noProjectsMsg = await generateResponse(
            `🌌 No creations in your cosmic vault yet, ${user}! Build something epic to ignite the stars!`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: noProjectsMsg,
            type: 'info',
            taskId,
            ip,
            user,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
            messageId: `${taskId}-no-projects`,
          });
        } else {
          const projectsMsg = await generateResponse(
            `🌟 Your cosmic vault, ${user}:\n${projectIds.map(id => `Task ${id}`).join('\n')}`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: projectsMsg,
            type: 'info',
            taskId,
            ip,
            user,
            frontendId,
            projects: projectIds,
            bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
            messageId: `${taskId}-projects`,
          });
        }
        await log(`Listed ${projectIds.length} projects for ${user} (ID: ${frontendId})`, { taskId });
        break;

      case 'delete':
        const taskIdToDelete = args.trim();
        if (!taskIdToDelete) {
          const noTaskIdMsg = await generateResponse(
            `🌌 Specify a task ID to vaporize, ${user}! Use /projects to see your creations.`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: noTaskIdMsg,
            type: 'error',
            taskId,
            ip,
            user,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskId}-delete-error`,
          });
          return;
        }
        const projectKey = `project:${user}:${taskIdToDelete}`;
        const projectExists = await redisClient.get(projectKey);
        if (!projectExists) {
          const notFoundMsg = await generateResponse(
            `🌌 Task ${taskIdToDelete} not found in your cosmic vault, ${user}!`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: notFoundMsg,
            type: 'error',
            taskId,
            ip,
            user,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskId}-delete-not-found`,
          });
          return;
        }
        await del(projectKey);
        await redisClient.sRem(`completedProjects:${user}`, taskIdToDelete);
        const deletedMsg = await generateResponse(
          `🌠 Task ${taskIdToDelete} vaporized from your cosmic vault, ${user}!`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: deletedMsg,
          type: 'success',
          taskId,
          ip,
          user,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskId}-delete-success`,
        });
        await log(`Deleted project ${taskIdToDelete} for ${user} (ID: ${frontendId})`, { taskId });
        break;

      case 'restart':
        const restartTaskId = args.trim();
        if (!restartTaskId) {
          const noRestartTaskIdMsg = await generateResponse(
            `🌌 Specify a task ID to restart, ${user}! Use /projects to see your creations.`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: noRestartTaskIdMsg,
            type: 'error',
            taskId,
            ip,
            user,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskId}-restart-error`,
          });
          return;
        }
        const restartMsg = await generateResponse(
          `🌌 Rebooting task ${restartTaskId}, ${user}! A pristine cosmic slate awaits—what’s your next vector?`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: restartMsg,
          type: 'question',
          taskId: restartTaskId,
          ip,
          user,
          frontendId,
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${restartTaskId}-restart`,
        });
        await redisClient.set(stateKey, JSON.stringify({ step: 'choice', taskId: restartTaskId }));
        await log(`Restarted task ${restartTaskId} for ${user} (ID: ${frontendId})`, { taskId });
        break;

      case 'store_project':
        const storeTaskId = args.trim();
        const taskData = await redisClient.hGet('tasks', storeTaskId);
        if (!taskData) {
          const noTaskMsg = await generateResponse(
            `🌌 Task ${storeTaskId} not found, ${user}! Cannot store cosmic relic.`,
            user,
            tone
          );
          await sendMessage(socket, {
            text: noTaskMsg,
            type: 'error',
            taskId,
            ip,
            user,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskId}-store-error`,
          });
          return;
        }
        const parsedTask = JSON.parse(taskData);
        await redisClient.set(`project:${user}:${storeTaskId}`, JSON.stringify(parsedTask));
        await redisClient.sAdd(`completedProjects:${user}`, storeTaskId);
        const storedMsg = await generateResponse(
          `✨ Task ${storeTaskId} stored in your cosmic vault, ${user}!`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: storedMsg,
          type: 'success',
          taskId,
          ip,
          user,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskId}-store-success`,
        });
        await log(`Stored project ${storeTaskId} for ${user} (ID: ${frontendId})`, { taskId });
        break;

      case 'clear_cache':
        const projectKeys = await redisClient.keys(`project:${user}:*`);
        if (projectKeys.length > 0) {
          await del(projectKeys);
          await redisClient.del(`completedProjects:${user}`);
          await log(`Cleared ${projectKeys.length} projects for ${user} (ID: ${frontendId})`, { taskId });
        }
        const clearMsg = await generateResponse(
          `🌌 Cosmic archives cleared for ${user}! Your vault is a blank canvas—create anew!`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: clearMsg,
          type: 'success',
          taskId,
          ip,
          user,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskId}-clear-success`,
        });
        break;

      case 'reset_all':
        const resetProjectKeys = await redisClient.keys(`project:${user}:*`);
        if (resetProjectKeys.length > 0) {
          await del(resetProjectKeys);
          await redisClient.del(`completedProjects:${user}`);
        }
        await redisClient.del(userKey);
        await redisClient.del(stateKey);
        await setUserName('Guest', frontendId);
        const resetMsg = await generateResponse(
          `🌌 Cosmic reset complete, ${user}! Welcome back as Guest—carve your new legacy in the stars!`,
          'Guest',
          tone
        );
        await sendMessage(socket, {
          text: resetMsg,
          type: 'question',
          taskId: `initial:${frontendId}`,
          ip,
          user: 'Guest',
          frontendId,
          options: ['Type your name below!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskId}-reset`,
        });
        await redisClient.set(stateKey, JSON.stringify({ step: 'name', taskId: `initial:${frontendId}` }));
        await log(`Reset all data for ${user} (ID: ${frontendId})`, { taskId });
        break;

      default:
        const unknownMsg = await generateResponse(
          `🌌 Unknown command "${command}", ${user}! Try /commands to see the cosmic codex.`,
          user,
          tone
        );
        await sendMessage(socket, {
          text: unknownMsg,
          type: 'error',
          taskId,
          ip,
          user,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskId}-unknown-command`,
        });
        await log(`Unknown command "${command}" from ${user} (ID: ${frontendId})`, { taskId });
    }
  } catch (err) {
    const errorMsg = await generateResponse(
      `🌌 Cosmic glitch executing "${command}", ${user}: ${err.message}. Retry, star voyager?`,
      user,
      tone
    );
    await sendMessage(socket, {
      text: errorMsg,
      type: 'error',
      taskId,
      ip,
      user,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `${taskId}-command-error`,
    });
    await error(`Command "${command}" failed for ${user} (ID: ${frontendId}): ${err.message}`, { taskId });
  }
}
