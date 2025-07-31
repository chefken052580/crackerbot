// bot_lead/src/taskManager.js
// Version: v2025-07-23-02
/**
 * Task Manager Module
 * Orchestrates CrackerBot’s cosmic task flow with supernova precision, managing task states and delegating to bot_backend.
 * Enhanced by xAI for robust WebSocket handling and Redis integration.
 *
 * @version 2025-07-23-02
 * @author CrackerBot Team, enhanced by xAI
 * @module taskManager
 */

import { log, error } from './logger.js';
import { cacheCompletedTask, getCompletedProjects } from './taskCache.js';
import { redisClient, hGet, hSet, get, set } from './redisClient.js';
import { botSocketPromise } from './socket.js';
import { sendMessage } from './taskHandlers.js';
import { executeCommand } from './commandHandler.js';

/**
 * Initializes Task Manager with WebSocket listeners.
 * @async
 */
export async function initializeTaskManager() {
  try {
    await log('🌌 Task Manager v2025-07-23-02 igniting—cosmic engines roaring!', { taskId: 'init' });
    const socket = await botSocketPromise;
    await log('🌌 Task Manager connected to WebSocket', { taskId: 'init', socketId: socket.id });

    socket.on('connect', async () => {
      await log('🌌 Task Manager online—cosmic circuits blazing!', { taskId: 'init', socketId: socket.id });
    });

    socket.on('command', async ({ command, args, frontendId, user, ip, taskId, target }) => {
      try {
        if (target !== 'bot_lead') {
          await log(`Ignoring command for target ${target}`, { taskId, frontendId });
          return;
        }
        await log(`Received command: ${command} from ${user} (ID: ${frontendId})`, { taskId, frontendId });
        const response = await executeCommand(command, args, user, frontendId, ip, taskId);
        if (response) {
          await sendMessage(socket, {
            text: response.text,
            type: response.type || 'success',
            taskId,
            ip,
            user,
            frontendId,
            options: response.options,
            bubbleStyle: response.bubbleStyle || { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
            messageId: `${taskId}-command-${Date.now()}`,
          });
        }
      } catch (err) {
        await error(`Command ${command} failed for ${user}: ${err.message}`, { taskId, frontendId });
        if (frontendId) {
          await sendMessage(socket, {
            text: `🌌 Cosmic command glitch, ${user}: ${err.message}. Retry, star voyager?`,
            type: 'error',
            taskId,
            ip,
            user,
            frontendId,
            options: ['Retry'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `error-${taskId}-${Date.now()}`,
          });
        }
      }
    });

    socket.on('task_result', async ({ taskId, userName, frontendId, ip, result, error: taskError }) => {
      try {
        await log(`Received task result for ${taskId} from ${userName} (ID: ${frontendId})`, { taskId, frontendId });
        const task = await hGet('tasks', taskId);
        if (!task) {
          await error(`Task ${taskId} not found`, { taskId, frontendId });
          return;
        }
        const taskData = JSON.parse(task);
        if (taskError) {
          await error(`Task ${taskId} failed: ${taskError}`, { taskId, frontendId });
          await sendMessage(socket, {
            text: `🌌 Cosmic assembly stalled for "${taskData.name}", ${userName}: ${taskError}. Retry or adjust?`,
            type: 'error',
            taskId,
            ip,
            user: userName,
            frontendId,
            taskName: taskData.name,
            taskType: taskData.type,
            taskFeatures: taskData.features,
            options: ['Retry', 'Adjust Features'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskId}-error`,
          });
          return;
        }

        await cacheCompletedTask({
          taskId,
          frontendId,
          ip,
          name: taskData.name,
          type: taskData.type,
          fileName: result.fileName,
          content: result.content,
          user: userName,
          features: taskData.features,
          version: taskData.version || 1,
        });

        taskData.status = 'completed';
        taskData.progress = 100;
        taskData.finalContent = result.content;
        taskData.fileName = result.fileName;
        taskData.downloadLink = result.downloadLink;
        await hSet('tasks', taskId, JSON.stringify(taskData));

        const stateKey = `taskState:${frontendId}`;
        const taskState = await get(stateKey);
        const parsedState = taskState && JSON.parse(taskState);
        if (parsedState) {
          parsedState.step = 'review';
          parsedState.finalContent = result.content;
          parsedState.fileName = result.fileName;
          parsedState.downloadLink = result.downloadLink;
          await set(stateKey, JSON.stringify(parsedState));
          if (parsedState.sessionId) {
            await set(`session:${parsedState.sessionId}`, JSON.stringify({ ...parsedState, user: userName }));
          }
        }

        await sendMessage(socket, {
          text: `✨ "${taskData.name}" forged in stardust, ${userName}! Review your cosmic creation! 🌌`,
          type: 'success',
          taskId,
          ip,
          user: userName,
          frontendId,
          taskName: taskData.name,
          taskType: taskData.type,
          taskFeatures: taskData.features,
          content: result.content,
          finalContent: result.content,
          fileName: result.fileName,
          downloadLink: result.downloadLink,
          options: ['Restart', 'Refine Project', 'Done'],
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskId}-completed`,
        });
        await log(`Task ${taskId} completed for ${userName} (ID: ${frontendId})`, { taskId, frontendId });
      } catch (err) {
        await error(`Failed to process task result for ${taskId}: ${err.message}`, { taskId, frontendId });
      }
    });

    socket.on('progressUpdate', async ({ taskId, progress, userName, frontendId, ip }) => {
      try {
        await log(`Progress update for ${taskId}: ${progress}%`, { taskId, frontendId });
        const task = await hGet('tasks', taskId);
        if (!task) {
          await error(`Task ${taskId} not found`, { taskId, frontendId });
          return;
        }
        const taskData = JSON.parse(task);
        taskData.progress = progress;
        await hSet('tasks', taskId, JSON.stringify(taskData));
        await sendMessage(socket, {
          text: `🌌 "${taskData.name}" progress: ${progress}%—cosmic assembly in motion!`,
          type: 'progressUpdate',
          taskId,
          ip,
          user: userName,
          frontendId,
          taskName: taskData.name,
          taskType: taskData.type,
          taskFeatures: taskData.features,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
          messageId: `${taskId}-progress-${Date.now()}`,
        });
      } catch (err) {
        await error(`Failed to process progress update for ${taskId}: ${err.message}`, { taskId, frontendId });
      }
    });

    socket.on('error', async (err) => {
      await error(`WebSocket error: ${err.message}`, { taskId: 'init' });
    });

    socket.on('disconnect', async () => {
      await error('⚠️ Task Manager offline—cosmic signal faded!', { taskId: 'init' });
    });

    await log('🌌 Task Manager fully ignited—cosmic listeners online!', { taskId: 'init' });
  } catch (err) {
    await error(`Task Manager supernova-failed: ${err.message}`, { taskId: 'init' });
    throw err;
  }
}

(async () => {
  try {
    await log('🌌 Task Manager v2025-07-23-02 igniting—cosmic engines roaring!', { taskId: 'init' });
    await initializeTaskManager();
    await log('🌌 Task Manager initialization complete', { taskId: 'init' });
  } catch (err) {
    await error(`Task Manager initialization failed: ${err.message}`, { taskId: 'init' });
    process.exit(1);
  }
})();