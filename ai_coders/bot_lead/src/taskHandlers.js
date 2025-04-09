/**
 * Task Handlers Module
 * Orchestrates CrackerBot’s cosmic task flow with supernova precision, welcoming users,
 * and handling multi-step tasks with interstellar flair. Enhanced by xAI for seamless
 * frontend-backend sync, robust Redis caching, and duplicate message prevention.
 *
 * @version 2025-04-09-04
 * @author CrackerBot Team, enhanced by xAI
 * @module taskHandlers
 */

import { log, error } from './logger.js';
import { get, set, hGet, hSet, hDel, storeMessage, del } from './redisClient.js';
import { emitCosmicMessage, delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';
import { getCompletedProjects, setUserName, cacheCompletedTask } from './taskCache.js';
import { executeCommand } from './commands/index.js';
import { botSocket } from './socket.js';

const TECH_STACKS = ['Full Stack', 'MEAN', 'MERN', 'LAMP', 'JAMstack'];
const TASK_TYPES = Object.keys(extensionMap)
  .filter((ext) => !TECH_STACKS.map((s) => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter((ext) => ext !== 'zip');
const BUILD_INTENT_KEYWORDS = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];

// Global WebSocket error listener
botSocket.on('error', async (err) => {
  await error(`WebSocket error: ${err.message}`);
});

/**
 * Sends a message via WebSocket with cosmic styling.
 * @param {Object} socket - WebSocket instance
 * @param {Object} message - Message data
 * @param {string} message.text - Message content
 * @param {string} [message.type='bot'] - Message type
 * @param {string} [message.taskId] - Task ID
 * @param {string} [message.from='CrackerBot Prime'] - Sender
 * @param {string} [message.target='bot_frontend'] - Target
 * @param {string} [message.ip] - IP address
 * @param {string} [message.user] - User name
 * @param {string} message.frontendId - Frontend ID (required)
 * @param {string[]} [message.options] - Response options
 * @param {string} [message.taskName] - Task name
 * @param {string} [message.taskType] - Task type
 * @param {string} [message.taskFeatures] - Task features
 * @param {string} [message.content] - Task content
 * @param {string} [message.finalContent] - Final task content
 * @param {string} [message.fileName] - File name
 * @param {string} [message.downloadLink] - Download link
 * @param {string} [message.messageId] - Unique message ID
 * @param {Object} [message.bubbleStyle] - Style for UI bubble
 */
export async function sendMessage(socket, message) {
  const {
    text,
    type = 'bot',
    taskId,
    from = 'CrackerBot Prime',
    target = 'bot_frontend',
    ip,
    user,
    frontendId,
    options,
    taskName,
    taskType,
    taskFeatures,
    content,
    finalContent,
    fileName,
    downloadLink,
    messageId,
    bubbleStyle = { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
  } = message;

  if (!frontendId) throw new Error('Missing frontendId in sendMessage');

  const staticBubbleStyle = { background: bubbleStyle.background, color: bubbleStyle.color };

  const msgData = {
    text,
    type,
    taskId,
    from,
    target,
    ip: ip || 'unknown',
    user: user || 'Guest',
    frontendId,
    options,
    taskName,
    taskType,
    taskFeatures,
    content,
    finalContent,
    fileName,
    downloadLink,
    messageId: messageId || `${taskId || Date.now()}-${type}`,
    bubbleStyle: staticBubbleStyle,
  };

  try {
    await emitCosmicMessage(msgData, socket);
    await log(`🚀 Beamed to ${target} for ${msgData.user} (ID: ${frontendId}): "${text}"`, { taskId });
  } catch (err) {
    await error(`Failed to beam message to ${target} for ${msgData.user} (ID: ${frontendId}): ${err.message}`, { taskId });
  }
}

/**
 * Signals cleanup of task files to bot_backend.
 * @param {string} taskId - Task ID
 * @param {string} userName - User name
 */
async function cleanupTaskFiles(taskId, userName) {
  await botSocket.emit('command', {
    command: 'cleanupTask',
    args: { taskId, userName },
    target: 'bot_backend',
  });
  await log(`🧹 Dispatched cleanup signal for task ${taskId} to bot_backend for ${userName}`, { taskId });
}

/**
 * Handles new frontend connections with a cosmic welcome, preventing duplicate options.
 * @param {Object} data - Connection data
 * @param {string} data.ip - IP address
 * @param {string} data.frontendId - Frontend ID
 * @param {string} [data.userName] - Initial user name
 * @param {string} [data.sessionId] - Session ID for persistence
 */
export async function handleFrontendConnected({ ip, frontendId, userName: initialName, sessionId }) {
  try {
    await log(`🌌 Frontend ${frontendId} warped in—${initialName || 'Guest'} primed for action!`);
    const stateKey = `taskState:${frontendId}`;
    const userKey = `user:${frontendId}`;
    const welcomeKey = `welcomeSent:${frontendId}`;

    let taskState;
    try {
      const storedState = await get(stateKey);
      taskState = storedState ? JSON.parse(storedState) : { step: 'name', taskId: `initial:${frontendId}` };
    } catch (parseErr) {
      await error(`Failed to parse taskState for ${frontendId}: ${parseErr.message}`);
      taskState = { step: 'name', taskId: `initial:${frontendId}` };
    }

    let persistedUserName;
    try {
      const userData = await get(userKey);
      persistedUserName = userData ? JSON.parse(userData).name : null;
    } catch (parseErr) {
      await error(`Failed to parse user data for ${frontendId}: ${parseErr.message}`);
      persistedUserName = null;
    }

    const effectiveUserName = initialName && /^[a-zA-Z0-9_-]{1,20}$/.test(initialName) 
      ? initialName 
      : persistedUserName && /^[a-zA-Z0-9_-]{1,20}$/.test(persistedUserName) 
        ? persistedUserName 
        : 'Guest';

    if (!persistedUserName || effectiveUserName !== persistedUserName) {
      await setUserName(effectiveUserName, frontendId);
      await log(`🌟 Persisted user name "${effectiveUserName}" for ${frontendId}`);
    }

    const welcomeSent = await get(welcomeKey);
    if (!welcomeSent) {
      if (effectiveUserName === 'Guest') {
        const welcomeMsg = await generateResponse(
          `Greetings, cosmic wanderer! Your star awaits naming—shine bright in the Luminara Serenity! 🌠`,
          effectiveUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: welcomeMsg,
          taskId: taskState.taskId,
          ip,
          user: effectiveUserName,
          frontendId,
          type: 'question',
          options: ['Type your name below!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskState.taskId}-welcome-name`,
        });
        taskState.step = 'name';
        await set(stateKey, JSON.stringify(taskState));
        await set(welcomeKey, 'true', 86400);
        await log(`🌟 Beamed welcome to ${effectiveUserName} (ID: ${frontendId})`);
      } else {
        const storedProjects = await getCompletedProjects(effectiveUserName);
        const projectCount = storedProjects.length;
        const welcomeMsg = await generateResponse(
          projectCount > 0
            ? `Back in orbit, ${effectiveUserName}! Your ${projectCount} stellar creation${projectCount === 1 ? '' : 's'} pulse in the cosmos—what’s next, galaxy shaper?`
            : `Welcome, ${effectiveUserName}! Let’s ignite a supernova of code across the universe! 🌌✨`,
          effectiveUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: welcomeMsg,
          taskId: taskState.taskId,
          ip,
          user: effectiveUserName,
          frontendId,
          type: 'success',
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
          messageId: `${taskState.taskId}-welcome-choice`,
        });
        taskState.step = 'choice';
        await set(stateKey, JSON.stringify(taskState));
        await set(welcomeKey, 'true', 86400);
        await log(`🌟 Beamed welcome to ${effectiveUserName} (ID: ${frontendId})`);
      }
    } else {
      await log(`🌌 Welcome already sent for ${effectiveUserName} (ID: ${frontendId}), resuming flow`);
      if (!taskState.step || taskState.step === 'name') {
        taskState.step = effectiveUserName === 'Guest' ? 'name' : 'choice';
        await set(stateKey, JSON.stringify(taskState));
        if (taskState.step === 'choice') {
          const resumeMsg = await generateResponse(
            `Welcome back, ${effectiveUserName}! Ready to blaze through the cosmos? 🌌`,
            effectiveUserName,
            DEFAULT_TONE
          );
          await sendMessage(botSocket, {
            text: resumeMsg,
            taskId: taskState.taskId,
            ip,
            user: effectiveUserName,
            frontendId,
            type: 'success',
            options: ['Chat', 'Build-Something-Epic'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
            messageId: `${taskState.taskId}-welcome-choice-resume`,
          });
        }
        await log(`🌌 Adjusted TaskState for ${effectiveUserName} (ID: ${frontendId}) to step: ${taskState.step}`);
      }
    }
  } catch (err) {
    await error(`Frontend connect error for ${frontendId}: ${err.message}`);
  }
}

/**
 * Processes user task responses and advances the cosmic workflow.
 * @param {Object} msg - Message data
 * @param {string} msg.text - User input
 * @param {string} [msg.user] - User name
 * @param {string} [msg.ip] - IP address
 * @param {string} msg.frontendId - Frontend ID
 * @param {string} [msg.type] - Message type
 * @param {string} [msg.taskId] - Task ID
 * @param {boolean} [msg.commandFlag] - Is it a command?
 * @param {Object} redisClient - Redis client instance
 */
export async function handleTaskResponse({ text, user, ip, frontendId, type, taskId, commandFlag }, redisClient) {
  const userKey = `user:${frontendId}`;
  const stateKey = `taskState:${frontendId}`;

  let taskState;
  try {
    const storedState = await get(stateKey);
    taskState = storedState ? JSON.parse(storedState) : { step: 'name', taskId: `initial:${frontendId}` };
  } catch (parseErr) {
    await error(`Failed to parse taskState for ${frontendId}: ${parseErr.message}`);
    taskState = { step: 'name', taskId: `initial:${frontendId}` };
  }

  let persistedUserName;
  try {
    const userData = await get(userKey);
    persistedUserName = userData ? JSON.parse(userData).name : user || 'Guest';
  } catch (parseErr) {
    await error(`Failed to parse user data for ${frontendId}: ${parseErr.message}`);
    persistedUserName = user || 'Guest';
  }

  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });
  await log(`📩 Decoding cosmic signal for ${persistedUserName} (ID: ${frontendId}): "${text}" - Orbiting step: ${taskState.step}`, { taskId: taskState.taskId });

  if (commandFlag) {
    const [command, ...args] = text.trim().split(' ');
    const cmd = command.toLowerCase().replace('/', '');
    if (cmd === 'clear_cache') {
      try {
        const projectKeys = await redisClient.keys(`project:${persistedUserName}:*`);
        if (projectKeys.length > 0) await redisClient.del(projectKeys);
        await del(`user:${frontendId}`);
        await del(`taskState:${frontendId}`);
        await del(`welcomeSent:${frontendId}`);
        const pendingTasks = await redisClient.hKeys('pendingTasks');
        for (const taskId of pendingTasks) {
          const task = await hGet('pendingTasks', taskId);
          if (task && task.frontendId === frontendId) await hDel('pendingTasks', taskId);
        }
        const tasks = await redisClient.hKeys('tasks');
        for (const taskId of tasks) {
          const task = await hGet('tasks', taskId);
          if (task && task.frontendId === frontendId) await hDel('tasks', taskId);
        }
        taskState = { step: 'name', taskId: `initial:${frontendId}` };
        await set(stateKey, JSON.stringify(taskState));
        await set(userKey, JSON.stringify({ name: 'Guest' }));
        const welcomeText = `🌠 Greetings, cosmic voyager! A fresh galaxy awaits—drop your name to ignite your journey!`;
        const welcomeMsg = await generateResponse(welcomeText, 'Guest', DEFAULT_TONE);
        await sendMessage(botSocket, {
          text: welcomeMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: 'Guest',
          frontendId,
          options: ['Type your name below!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskState.taskId}-welcome-name`,
        });
        await log(`🧹 Purged cosmic archives for ${persistedUserName} (frontendId: ${frontendId}), reset to virgin orbit`);
      } catch (err) {
        await error(`Cache purge failed for ${persistedUserName}: ${err.message}`);
        const errorMsg = await generateResponse(
          `🌠 Cosmic cleanse stalled, ${persistedUserName}: ${err.message}. Retry, star duster?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'error',
          ip,
          user: persistedUserName,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        });
      }
      return;
    }
    if (cmd === 'projects' && !['choice', 'chatting'].includes(taskState.step)) {
      const buildModeMsg = await generateResponse(
        `🌌 Hold up, ${persistedUserName}! You’re forging a stellar masterpiece—finish or reset to peek at your cosmic vault.`,
        persistedUserName,
        DEFAULT_TONE
      );
      await sendMessage(botSocket, {
        text: buildModeMsg,
        type: 'error',
        ip,
        user: persistedUserName,
        frontendId,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      });
      return;
    }
    await executeCommand(botSocket, {
      command: cmd,
      frontendId,
      user: persistedUserName,
      tone: DEFAULT_TONE,
      ip,
      taskId: taskId || taskState.taskId,
      userKey,
      stateKey,
      args: args.join(' '),
    }, redisClient);
    return;
  }

  const choice = text || '';
  if (!choice && taskState.step !== 'building') {
    const noInputMsg = await generateResponse(
      `🌌 Speak, ${persistedUserName}! The galaxy hungers for your cosmic command!`,
      persistedUserName,
      DEFAULT_TONE
    );
    await sendMessage(botSocket, {
      text: noInputMsg,
      type: 'error',
      ip,
      user: persistedUserName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    });
    return;
  }

  switch (taskState.step) {
    case 'name':
      if (choice && /^[a-zA-Z0-9_-]+$/.test(choice) && choice.length <= 20) {
        persistedUserName = choice.trim();
        await setUserName(persistedUserName, frontendId);
        taskState.step = 'choice';
        taskState.taskId = `initial:${frontendId}`;
        await set(stateKey, JSON.stringify(taskState));
        const welcomeMsg = await generateResponse(
          `✨ Galactic gates open, ${persistedUserName}! Forge your legend in the stars! 🌟🚀`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: welcomeMsg,
          type: 'success',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
          messageId: `${taskState.taskId}-welcome-choice`,
        });
        await set(`welcomeSent:${frontendId}`, 'true', 86400);
        await log(`🌠 Christened ${persistedUserName} for ${frontendId} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else {
        const invalidNameMsg = await generateResponse(
          `🌌 "${choice}" won’t orbit—max 20 chars, alphanumeric only. Retry, cosmic namer!`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: invalidNameMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Type your name below!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskState.taskId}-welcome-name-retry`,
        });
      }
      break;

    case 'choice':
      const choiceLower = choice.toLowerCase();
      if (choiceLower === 'chat') {
        const chatPrompt = await generateResponse(
          `🗣️ Cosmic comms online, ${persistedUserName}! What wisdom shall we weave through the ether?`,
          persistedUserName,
          DEFAULT_TONE
        );
        taskState.step = 'chatting';
        await set(stateKey, JSON.stringify(taskState));
        await sendMessage(botSocket, {
          text: chatPrompt,
          type: 'question',
          taskId: `chat:${Date.now()}`,
          ip,
          user: persistedUserName,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `chat:${Date.now()}`,
        });
        await log(`🗣️ Chat channel opened for ${persistedUserName} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else if (choiceLower === 'build-something-epic' || BUILD_INTENT_KEYWORDS.some((k) => choiceLower.includes(k))) {
        const newTaskId = Date.now().toString();
        taskState.step = 'project_name';
        taskState.taskId = newTaskId;
        await set(stateKey, JSON.stringify(taskState));
        const buildPrompt = await generateResponse(
          `⚒️ Unleash your stellar craft, ${persistedUserName}! Name your cosmic creation to ignite the forge! 🌌⚡`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: buildPrompt,
          type: 'question',
          taskId: newTaskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Name your project!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
          messageId: `${newTaskId}-project_name`,
        });
        await log(`⚒️ Build saga initiated for ${persistedUserName} with task ${newTaskId} - Warped to step: ${taskState.step}`, { taskId: newTaskId });
      } else {
        const invalidChoiceMsg = await generateResponse(
          `🌠 ${persistedUserName}, align your orbit: 'Chat' or 'Build-Something-Epic'. The stars await!`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: invalidChoiceMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskState.taskId}-choice-retry`,
        });
      }
      break;

    case 'project_name':
      if (choice && /^[a-zA-Z0-9_-]+$/.test(choice) && choice.length <= 50) {
        const taskName = choice.trim().toLowerCase().replace(/\s+/g, '-');
        taskState.step = 'type';
        taskState.taskName = taskName;
        await set(stateKey, JSON.stringify(taskState));
        const pendingMsg = await generateResponse(
          `🌟 Stellar blueprint "${taskName}" primed, ${persistedUserName}! Awaiting tech alignment—launch imminent! 🚀`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: pendingMsg,
          type: 'pending',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          taskName,
          bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#fff' },
          messageId: `${taskState.taskId}-pending`,
        });
        const typePrompt = await generateResponse(
          `✨ Tech constellation for "${taskName}", ${persistedUserName}? Choose your galactic framework! 🌌`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: typePrompt,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: [...TECH_STACKS, ...TASK_TYPES],
          taskName,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskState.taskId}-type`,
        });
        await log(`🌟 "${taskName}" pending for ${persistedUserName} (ID: ${frontendId}) - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else {
        const invalidNameMsg = await generateResponse(
          `🌌 "${choice}" won’t hold orbit—50 chars max, alphanumeric only! Rename your cosmic relic, ${persistedUserName}!`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: invalidNameMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Name your project!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskState.taskId}-project_name-retry`,
        });
      }
      break;

    case 'type':
      const selectedType = choice.toLowerCase();
      const validTypes = [...TECH_STACKS.map((s) => s.toLowerCase()), ...TASK_TYPES];
      if (validTypes.includes(selectedType)) {
        taskState.step = selectedType === 'full stack' ? 'network' : 'pending_features';
        taskState.taskType = selectedType;
        await set(stateKey, JSON.stringify(taskState));
        const nextPrompt = taskState.step === 'network'
          ? await generateResponse(
              `🌌 Full Stack cosmos activated, ${persistedUserName}! Which network will "${taskState.taskName}" orbit?`,
              persistedUserName,
              DEFAULT_TONE
            )
          : await generateResponse(
              `✨ "${selectedType}" locked for "${taskState.taskName}", ${persistedUserName}! What features will ignite this stellar creation? 🌠`,
              persistedUserName,
              DEFAULT_TONE
            );
        await sendMessage(botSocket, {
          text: nextPrompt,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: taskState.step === 'network' 
            ? ['mainnet-beta', 'testnet', 'devnet', 'none'] 
            : ['Type your feature details!'],
          taskName: taskState.taskName,
          taskType: selectedType,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `${taskState.taskId}-${taskState.step}`,
        });
        await log(`🌟 Type "${selectedType}" aligned for ${persistedUserName} (ID: ${frontendId}) - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else {
        const invalidTypeMsg = await generateResponse(
          `🌠 "${choice}" drifts beyond our galaxy, ${persistedUserName}! Select a valid tech orbit.`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: invalidTypeMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: [...TECH_STACKS, ...TASK_TYPES],
          taskName: taskState.taskName,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskState.taskId}-type-retry`,
        });
      }
      break;

    case 'network':
      taskState.network = choice.toLowerCase() === 'none' ? null : choice || 'mainnet-beta';
      taskState.step = 'pending_features';
      await set(stateKey, JSON.stringify(taskState));
      const featuresPrompt = await generateResponse(
        `🌌 ${taskState.network || 'No network'} orbit secured, ${persistedUserName}! What features will blaze "${taskState.taskName}" into legend?`,
        persistedUserName,
        DEFAULT_TONE
      );
      await sendMessage(botSocket, {
        text: featuresPrompt,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: persistedUserName,
        frontendId,
        options: ['Type your feature details!'],
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
        messageId: `${taskState.taskId}-features`,
      });
      await log(`🌟 Network "${taskState.network || 'none'}" locked for ${persistedUserName} (ID: ${frontendId}) - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      break;

    case 'pending_features':
      taskState.features = choice || 'basic cosmic functionality';
      taskState.step = 'building';
      await set(stateKey, JSON.stringify(taskState));
      await updateTaskStatus(taskState.taskId, 'in_progress');
      const buildStartMsg = await generateResponse(
        `⚡ "${taskState.taskName}" ignites with "${taskState.features}", ${persistedUserName}! Cosmic assembly in motion! 🌌✨`,
        persistedUserName,
        DEFAULT_TONE
      );
      await sendMessage(botSocket, {
        text: buildStartMsg,
        type: 'building',
        taskId: taskState.taskId,
        ip,
        user: persistedUserName,
        frontendId,
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        taskFeatures: taskState.features,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
        messageId: `${taskState.taskId}-building`,
      });
      try {
        await delegateTask(botSocket, 'bot_backend', 'buildTask', {
          task: {
            id: taskState.taskId,
            name: taskState.taskName,
            type: taskState.taskType,
            features: taskState.features,
            network: taskState.network,
            flair: true,
            aiInstructions: `Forge "${taskState.taskName}" for ${persistedUserName} with "${taskState.features}"—infuse cosmic animations, stellar annotations, and optimized galactic structures!`,
          },
          userName: persistedUserName,
          tone: DEFAULT_TONE,
          frontendId,
        });
        await log(`⚒️ Task ${taskState.taskId} delegated for ${persistedUserName} with "${taskState.features}" - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } catch (err) {
        await error(`Delegation failed for ${persistedUserName} (Task ${taskState.taskId}): ${err.message}`, { taskId: taskState.taskId });
        const retryMsg = await generateResponse(
          `🌌 Cosmic relay hiccup, ${persistedUserName}! Build signal lost: ${err.message}. Retry or adjust features?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: retryMsg,
          type: 'error',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Retry', 'Adjust Features'],
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          taskFeatures: taskState.features,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskState.taskId}-build-error`,
        });
        // Keep state as 'building' to await user retry
        await log(`🌌 Awaiting retry for ${persistedUserName} (Task ${taskState.taskId})`, { taskId: taskState.taskId });
      }
      break;

    case 'building':
      const buildChoiceLower = choice.toLowerCase();
      if (buildChoiceLower === 'retry') {
        try {
          const retryStartMsg = await generateResponse(
            `⚡ Relay reestablished, ${persistedUserName}! "${taskState.taskName}" build resumes—cosmic engines roaring! 🌌`,
            persistedUserName,
            DEFAULT_TONE
          );
          await sendMessage(botSocket, {
            text: retryStartMsg,
            type: 'building',
            taskId: taskState.taskId,
            ip,
            user: persistedUserName,
            frontendId,
            taskName: taskState.taskName,
            taskType: taskState.taskType,
            taskFeatures: taskState.features,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
            messageId: `${taskState.taskId}-building-retry`,
          });
          await delegateTask(botSocket, 'bot_backend', 'buildTask', {
            task: {
              id: taskState.taskId,
              name: taskState.taskName,
              type: taskState.taskType,
              features: taskState.features,
              network: taskState.network,
              flair: true,
              aiInstructions: `Forge "${taskState.taskName}" for ${persistedUserName} with "${taskState.features}"—infuse cosmic animations, stellar annotations, and optimized galactic structures!`,
            },
            userName: persistedUserName,
            tone: DEFAULT_TONE,
            frontendId,
          });
          await log(`⚒️ Retry successful for ${persistedUserName} (Task ${taskState.taskId})`, { taskId: taskState.taskId });
        } catch (retryErr) {
          await error(`Retry failed for ${persistedUserName} (Task ${taskState.taskId}): ${retryErr.message}`, { taskId: taskState.taskId });
          const retryFailMsg = await generateResponse(
            `🌌 Persistent static, ${persistedUserName}! Retry failed: ${retryErr.message}. Adjust or retry again?`,
            persistedUserName,
            DEFAULT_TONE
          );
          await sendMessage(botSocket, {
            text: retryFailMsg,
            type: 'error',
            taskId: taskState.taskId,
            ip,
            user: persistedUserName,
            frontendId,
            options: ['Retry', 'Adjust Features'],
            taskName: taskState.taskName,
            taskType: taskState.taskType,
            taskFeatures: taskState.features,
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `${taskState.taskId}-build-retry-error`,
          });
        }
      } else if (buildChoiceLower === 'adjust features') {
        taskState.step = 'pending_features';
        await set(stateKey, JSON.stringify(taskState));
        const adjustMsg = await generateResponse(
          `🌟 Tuning "${taskState.taskName}", ${persistedUserName}! What new cosmic sparks shall we fuse?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: adjustMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Type your feature details!'],
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          taskFeatures: taskState.features,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `${taskState.taskId}-adjust-features`,
        });
        await log(`🌟 Adjusted to pending_features for ${persistedUserName} (Task ${taskState.taskId})`, { taskId: taskState.taskId });
      }
      break;

    case 'review':
      const reviewChoiceLower = choice.toLowerCase();
      if (reviewChoiceLower === 'refine project') {
        taskState.step = 'pending_features';
        await set(stateKey, JSON.stringify(taskState));
        const refineMsg = await generateResponse(
          `🌟 Amplifying "${taskState.taskName}", ${persistedUserName}! What new cosmic threads shall we weave into this masterpiece?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: refineMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Type your additional features!'],
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          taskFeatures: taskState.features,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `${taskState.taskId}-refine`,
        });
        await log(`🌟 Refining task ${taskState.taskId} for ${persistedUserName} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else if (reviewChoiceLower === 'restart') {
        taskState.step = 'choice';
        taskState.features = null;
        await set(stateKey, JSON.stringify(taskState));
        const restartMsg = await generateResponse(
          `🌌 Rebooting "${taskState.taskName}", ${persistedUserName}! A pristine cosmic slate awaits—what’s your next vector?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: restartMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Chat', 'Build-Something-Epic'],
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `${taskState.taskId}-restart`,
        });
        await log(`🌌 Rebooted task ${taskState.taskId} for ${persistedUserName} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else if (reviewChoiceLower === 'done') {
        await cleanupTaskFiles(taskState.taskId, persistedUserName);
        await updateTaskStatus(taskState.taskId, 'completed');
        await cacheCompletedTask({
          taskId: taskState.taskId,
          userName: persistedUserName,
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          features: taskState.features,
          network: taskState.network,
          frontendId,
        });
        await hDel('tasks', taskState.taskId);
        taskState.step = 'choice';
        taskState.taskId = `initial:${frontendId}`;
        await set(stateKey, JSON.stringify(taskState));
        const doneMsg = await generateResponse(
          `✨ "${taskState.taskName}" etched in stardust, ${persistedUserName}! Your cosmic vault grows—what’s next, starforge?`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: doneMsg,
          type: 'success',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskState.taskId}-done`,
        });
        await log(`✅ Task ${taskState.taskId} sealed in stardust for ${persistedUserName} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
      } else {
        const invalidOptionMsg = await generateResponse(
          `🌠 "${choice}" veers off course, ${persistedUserName}! Chart your path for "${taskState.taskName}":`,
          persistedUserName,
          DEFAULT_TONE
        );
        await sendMessage(botSocket, {
          text: invalidOptionMsg,
          type: 'question',
          taskId: taskState.taskId,
          ip,
          user: persistedUserName,
          frontendId,
          options: ['Restart', 'Refine Project', 'Done'],
          taskName: taskState.taskName,
          taskType: taskState.taskType,
          taskFeatures: taskState.features,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskState.taskId}-review-retry`,
        });
      }
      break;

    case 'chatting':
      const chatResponse = await generateResponse(
        `${persistedUserName}, your echo: "${choice}". What’s next in our cosmic colloquy?`,
        persistedUserName,
        DEFAULT_TONE
      );
      if (!taskState.lastChatPrompt || taskState.lastChatPrompt !== choice) {
        await sendMessage(botSocket, {
          text: chatResponse,
          type: 'success',
          taskId: `chat:${Date.now()}`,
          ip,
          user: persistedUserName,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `chat:${Date.now()}`,
        });
        taskState.lastChatPrompt = choice;
        await set(stateKey, JSON.stringify(taskState));
        await log(`🗣️ Cosmic banter beamed for ${persistedUserName} (ID: ${frontendId}) - Holding at step: ${taskState.step}`, { taskId: taskState.taskId });
      }
      await storeMessage(persistedUserName, { text: choice, timestamp: new Date().toISOString(), frontendId });
      break;

    default:
      const lostMsg = await generateResponse(
        `🌌 We’ve veered into the void, ${persistedUserName}! Realign your cosmic compass—where to next?`,
        persistedUserName,
        DEFAULT_TONE
      );
      taskState.step = 'choice';
      taskState.taskId = `initial:${frontendId}`;
      await set(stateKey, JSON.stringify(taskState));
      await sendMessage(botSocket, {
        text: lostMsg,
        type: 'error',
        ip,
        user: persistedUserName,
        frontendId,
        options: ['Chat', 'Build-Something-Epic'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `${taskState.taskId}-reset`,
      });
      await error(`Reset orbit for ${frontendId} from unknown step: ${taskState.step || 'undefined'} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId });
  }
}

/**
 * Initializes WebSocket listeners for task handling.
 * @param {Object} redisClient - Redis client instance
 */
export function initializeTaskListeners(redisClient) {
  botSocket.on('frontend_connected', handleFrontendConnected);

  botSocket.on('message', async (msg) => {
    const { text, user, ip, frontendId, type, taskId, commandFlag } = msg;
    await log(`📩 Cosmic transmission received: ${JSON.stringify(msg)}`, { taskId });
    try {
      if (type === 'task_response' || commandFlag || text) {
        await handleTaskResponse(msg, redisClient);
      }
    } catch (err) {
      let errorText = err.message.includes('WebSocket not connected')
        ? `Cosmic static, ${user || 'Guest'}—reconnection imminent!`
        : `Stellar glitch, ${user || 'Guest'}: ${err.message}. Retry, cosmic pioneer?`;
      const errorMsg = await generateResponse(errorText, user || 'Guest', DEFAULT_TONE);
      await sendMessage(botSocket, {
        text: errorMsg,
        type: 'error',
        ip,
        user: user || 'Guest',
        frontendId,
        options: ['Retry'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `error:${Date.now()}`,
      });
      await error(`Cosmic error for ${user || 'Guest'}: ${err.stack}`, { taskId });
    }
  });

  botSocket.on('connect', async () => await log('🌌 Task Handlers online—stellar circuits blazing!'));
  botSocket.on('disconnect', async () => await error('⚠️ Task Handlers offline—cosmic signal faded!'));
}

(async () => {
  await log('🌌 Task Handlers ablaze—cosmic circuits pulsing with interstellar swagger!');
})();