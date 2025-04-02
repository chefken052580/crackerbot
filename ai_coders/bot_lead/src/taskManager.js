/**
 * Task Manager Module
 * Orchestrates CrackerBot’s cosmic task flow with swagger and precision.
 * Manages frontend connections, task results, and messages with interstellar flair.
 * Enhanced by xAI for single-response workflow alignment with taskHandlers v2025-04-01-16.
 *
 * @version 2025-04-01-8
 * @author CrackerBot Team, enhanced by xAI
 */

import { log, error } from './logger.js';
import { redisClient, get, set, hGet, hSet, hDel } from './redisClient.js';
import { cacheCompletedTask, getCompletedProjects, getLatestProject } from './taskCache.js';
import { setLastGeneratedTask, delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { executeCommand } from './commands/index.js';
import { DEFAULT_TONE } from './constants.js';
import { botSocket } from './socket.js';
import taskHandlers from './taskHandlers.js';
import { processGeneralMessage } from './messageUtils.js';

// Track sent prompts to prevent loops
const sentPrompts = new Map();

/**
 * Initializes the task manager with cosmic vibes.
 * @param {Object} botSocketArg - Optional WebSocket socket override
 * @returns {Object} - The initialized socket
 */
export async function initTaskManager(botSocketArg) {
  const socket = botSocketArg || botSocket;
  await log(`🌌 Task Manager blazing at ${socket.io.uri} - ready to drop cosmic fireworks! 🎇`);

  socket.on('connect_error', async (err) => {
    await error(`⚠️ WebSocket glitch: ${err.message} - CrackerBot’s too dope to drop!`);
    await taskHandlers.sendMessage(socket, {
      text: `Connection snag: ${err.message}. Retrying with cosmic swagger... ⚡`,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect', async (attempt) => {
    await log(`🌩️ Reconnected after ${attempt} rounds - CrackerBot’s unstoppable!`);
    await taskHandlers.sendMessage(socket, {
      text: `Back in action after ${attempt} tries—let’s roll with interstellar thunder! ⚡`,
      type: 'system',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect_error', async (err) => {
    await error(`⚠️ Reconnect fumbled: ${err.message} - we’ll smash it soon!`);
  });

  socket.on('disconnect', async () => {
    await log('💤 Task Manager’s chilling - WebSocket’s on a cosmic break!');
    await taskHandlers.sendMessage(socket, {
      text: 'CrackerBot Prime’s taking a quick breather—back with supernova heat soon! 🔥',
      type: 'system',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
    });
  });

  socket.on('frontend_connected', async (data) => {
    await log(`🌌 Frontend ${data.frontendId} connected - ${data.userName || 'Guest'} ready!`);
    await taskHandlers.handleFrontendConnected(data, redisClient); // Delegate to taskHandlers
  });

  socket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip, taskFeatures, version, error: taskError, progress, requestId, leadId }) => {
    try {
      await log(`🌠 Task ${taskId} landed for ${frontendId} - ${content ? content.length : 'null'} chars of pure cosmic fire! 🔥`);
      const task = await hGet('tasks', taskId);
      if (!task) {
        await error(`⚠️ Task ${taskId} ghosted us in taskResult - where’d it go?`);
        return;
      }
      const userKey = `user:${frontendId}`;
      const stateKey = `taskState:${frontendId}`;
      const userName = await redisClient.get(userKey) || task.user || 'Guest';
      const tone = await get(`user:${frontendId}:tone`) || DEFAULT_TONE;

      if (progress !== undefined) {
        const progressMsg = await generateResponse(
          `⚙️ Cranking "${name}", ${userName}! ${progress}% in the bag—${progress === 50 ? 'halfway to epic!' : progress === 75 ? 'almost golden!' : progress === 100 ? 'cosmic finish!' : 'still blazing!'} 🌩️`,
          userName,
          tone
        );
        await taskHandlers.sendMessage(socket, {
          text: progressMsg,
          type: 'progressUpdate',
          taskId,
          progress,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
        });
        await log(`📈 Progress update: ${progress}% for task ${taskId}`);
        return;
      }

      if (taskError) {
        const errorMsg = await generateResponse(
          `💥 Whoa, ${userName}! "${name}" hit a cosmic snag: ${taskError}. Retry or remix?`,
          userName,
          tone
        );
        await taskHandlers.sendMessage(socket, {
          text: errorMsg,
          type: 'error',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures: task.features,
          options: ['Retry', 'Tweak it'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        });
        await hDel('tasks', taskId);
        return;
      }

      await cacheCompletedTask({
        taskId,
        frontendId,
        ip,
        name,
        type,
        fileName,
        content,
        user: userName,
        features: taskFeatures || task.features,
        version: version || task.version || 1,
      });
      setLastGeneratedTask({ taskId, content, fileName, type, name, frontendId });

      const downloadMsg = await generateResponse(
        `🎆 Boom, ${userName}! "${name}" (${type}${version ? ` v${version}` : ''}) is locked and loaded—grab this cosmic gem! 🌟`,
        userName,
        tone
      );
      await taskHandlers.sendMessage(socket, {
        text: downloadMsg,
        type: 'taskResult',
        taskId,
        content,
        finalContent: content,
        fileName,
        downloadLink: `data:application/zip;base64,${content}`,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: taskFeatures || task.features,
        options: ['Restart', 'Refine Project', 'Done'],
        bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
      });

      task.step = 'review';
      task.status = 'pending_review';
      task.user = userName;
      await hSet('tasks', taskId, task);
      await set(stateKey, JSON.stringify({ step: 'review', taskId }));
      await updateTaskStatus(taskId, 'pending_review');
    } catch (err) {
      await error(`💥 Task ${taskId} flopped: ${err.message} - CrackerBot’s on the case!`);
    }
  });

  socket.on('message', async (message) => {
    await processMessage(socket, message, redisClient);
  });

  socket.on('reset_user', async ({ userId, ip }) => {
    const frontendId = userId;
    const userKey = `user:${frontendId}`;
    const stateKey = `taskState:${frontendId}`;
    const userInfoKey = `user:${frontendId}:info`;
    await redisClient.del(userKey);
    await redisClient.del(userInfoKey);
    await redisClient.del(stateKey);
    await log(`🌀 Reset user for frontendId ${frontendId} - fresh cosmic slate incoming!`);
    const resetPrompt = await generateResponse(
      `🌀 Yo, reset complete! I’m CrackerBot Prime—what’s your new name, champ? Drop it below! ✨`,
      'Guest',
      DEFAULT_TONE
    );
    await taskHandlers.sendMessage(socket, {
      text: resetPrompt,
      type: 'question',
      taskId: `initial:${frontendId}`,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: 'Guest',
      options: ['Type your name below!'],
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
    });
    sentPrompts.delete(`${frontendId}:namePrompt`);
  });

  socket.on('error', async (err) => {
    await error(`⚠️ WebSocket hiccup: ${err.message} - we’ll bounce back slicker!`);
  });

  socket.on('reconnect_attempt', async (attempt) => {
    await log(`🌩️ Reconnect attempt #${attempt} - CrackerBot’s got cosmic grit!`);
  });

  if (socket.connected) {
    await taskHandlers.sendMessage(socket, {
      text: '🎵 CrackerBot Prime’s live and dropping cosmic beats—ready to code with interstellar flair! Who’s up? 🎤',
      type: 'system',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
    });
  }

  await log('🌌 Task Manager’s live and dripping with supernova swagger!');
  return socket;
}

/**
 * Processes incoming messages with stellar precision.
 * @param {Object} botSocket - WebSocket socket
 * @param {Object} message - Incoming message
 * @param {Object} redisClient - Redis client instance
 */
export async function processMessage(botSocket, message, redisClient) {
  await log(`📩 CrackerBot Prime snagged a hot one: ${JSON.stringify(message)} - let’s roll!`);

  if (!botSocket || !botSocket.connected) {
    await error('⚠️ WebSocket’s snoozing - can’t vibe with this message!');
    return;
  }

  const frontendId = message.frontendId || botSocket.id;
  const ip = message.ip || 'unknown';
  const userKey = `user:${frontendId}`;
  const toneKey = `user:${frontendId}:tone`;
  const stateKey = `taskState:${frontendId}`;
  let userName = await redisClient.get(userKey) || message.user || 'Guest';
  let tone = await get(toneKey) || DEFAULT_TONE;

  try {
    if (message.commandFlag || message.type === 'command') {
      const commandText = message.text && message.text.startsWith('/') ? message.text.split(' ')[0].substring(1) : message.text || '';
      if (!commandText) {
        throw new Error('No command provided—give me a cosmic signal!');
      }
      await executeCommand(botSocket, { ...message, command: commandText, user: userName, tone, ip, frontendId }, redisClient);
      return;
    }

    if (message.type === 'task_response') {
      await taskHandlers.handleTaskResponse(message, redisClient);
      sentPrompts.delete(`${frontendId}:chatPrompt`);
      return;
    }

    const chatPromptKey = `${frontendId}:chatPrompt`;
    if (message.text.includes('What’s your favorite tech stack?') && sentPrompts.has(chatPromptKey)) {
      await log(`⏳ Skipping repeat chat prompt for ${frontendId} - awaiting cosmic response!`);
      return;
    }

    await processGeneralMessage(botSocket, message.text || '', userName, tone, ip, frontendId);
    if (message.text.includes('What’s your favorite tech stack?')) {
      sentPrompts.set(chatPromptKey, Date.now());
    }
  } catch (err) {
    await error(`💥 CrackerBot Prime hit a glitch for ${userName}: ${err.message}`);
    const errorMsg = await generateResponse(
      `💥 Yo ${userName}, we hit a cosmic snag: ${err.message}. Let’s retry this interstellar jam!`,
      userName,
      tone
    );
    await taskHandlers.sendMessage(botSocket, {
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    });
  }
}