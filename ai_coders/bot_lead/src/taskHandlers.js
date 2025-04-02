/**
 * Task Handlers Module
 * Orchestrates CrackerBot’s cosmic task flow with supernova precision, welcoming users,
 * and handling multi-step tasks with interstellar flair. Enhanced by xAI for single-response workflow
 * and Redis state synchronization.
 *
 * @version 2025-04-01-17
 * @author CrackerBot Team, enhanced by xAI
 * @module taskHandlers
 */

import { log, error } from './logger.js';
import { get, set, hGet, hSet, hDel, storeMessage } from './redisClient.js';
import { emitCosmicMessage, delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';
import { getCompletedProjects, setUserName } from './taskCache.js';
import { executeCommand } from './commands/index.js';
import { botSocket } from './socket.js';

// Task type definitions with cosmic categorization
const TECH_STACKS = ['Full Stack', 'MEAN', 'MERN', 'LAMP', 'JAMstack'];
const TASK_TYPES = Object.keys(extensionMap)
  .filter((ext) => !TECH_STACKS.map((s) => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter((ext) => ext !== 'zip');
const BUILD_INTENT_KEYWORDS = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];

/**
 * Sends a message via WebSocket with cosmic flair and static presentation.
 * @async
 * @function sendMessage
 * @param {Object} socket - WebSocket instance (unused, kept for compatibility)
 * @param {Object} message - Message payload with static styling
 * @param {string} message.text - Message content
 * @param {string} [message.type] - Message type (e.g., 'question', 'success')
 * @param {string} [message.taskId] - Task identifier
 * @param {string} [message.from='CrackerBot Prime'] - Sender name
 * @param {string} [message.target='bot_frontend'] - Target bot
 * @param {string} [message.ip] - Client IP
 * @param {string} [message.user] - User name
 * @param {string} message.frontendId - Unique frontend identifier
 * @param {string[]} [message.options] - User response options
 * @param {string} [message.taskName] - Project name
 * @param {string} [message.taskType] - Project type
 * @param {string} [message.taskFeatures] - Project features
 * @param {string} [message.content] - Task content
 * @param {string} [message.finalContent] - Final task content
 * @param {string} [message.fileName] - File name
 * @param {string} [message.downloadLink] - Download URL
 * @param {string} [message.messageId] - Unique message identifier
 * @param {Object} [message.bubbleStyle] - Static bubble styling (no animations)
 * @returns {Promise<void>}
 */
async function sendMessage(socket, message) {
  const {
    text,
    type,
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

  const staticBubbleStyle = { background: bubbleStyle.background, color: bubbleStyle.color };

  const msgData = {
    text,
    type,
    taskId,
    from,
    target,
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
    messageId: messageId || `${taskId || Date.now()}-${type || 'message'}`,
    bubbleStyle: staticBubbleStyle,
  };

  await emitCosmicMessage(msgData, botSocket);
  await log(`🚀 Sent to ${target} for ${user || 'Guest'} (ID: ${frontendId}): "${text}"`);
}

/**
 * Signals bot_backend to clean up temporary task files with cosmic efficiency.
 * @async
 * @function cleanupTaskFiles
 * @param {string} taskId - Task ID to clean up
 * @param {string} userName - User requesting cleanup
 * @returns {Promise<void>}
 */
async function cleanupTaskFiles(taskId, userName) {
  await botSocket.emit('command', {
    command: 'cleanupTask',
    args: { taskId, userName },
    target: 'bot_backend',
  });
  await log(`🧹 Signaled cleanup for taskId ${taskId} to bot_backend for ${userName}`);
}

/**
 * Handles new frontend connections with a single cosmic greeting based on user state.
 * @async
 * @param {Object} data - Connection data from WebSocket
 * @param {string} data.frontendId - Unique frontend identifier
 * @param {string} [data.userName] - Initial user name (optional)
 * @param {string} [data.ip] - Client IP
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
async function handleFrontendConnected({ frontendId, userName: initialName, ip }, redisClient) {
  const userKey = `user:${frontendId}`;
  const stateKey = `taskState:${frontendId}`;
  let userName = await get(userKey) || initialName || 'Guest';
  let taskState = await get(stateKey);

  try {
    await log(`🌠 Cosmic traveler detected! Frontend ID: ${frontendId}, IP: ${ip}`);

    if (!taskState) {
      taskState = { step: userName === 'Guest' ? 'name' : 'choice', taskId: `initial:${frontendId}` };
      await set(stateKey, JSON.stringify(taskState));
    } else {
      taskState = JSON.parse(taskState);
    }

    const storedProjects = await redisClient.keys(`project:${userName}:*`);
    const projectCount = storedProjects.length;
    const isReturningUser = projectCount > 0 && userName !== 'Guest';

    if (isReturningUser && taskState.step !== 'name') {
      const welcomeText = `🌟 Welcome back, ${userName}! Your cosmic vault holds ${projectCount} masterpiece${projectCount === 1 ? '' : 's'}. What's your next stellar adventure?`;
      const welcomeMsg = await generateResponse(welcomeText, userName, DEFAULT_TONE);
      await sendMessage(botSocket, {
        text: welcomeMsg,
        type: 'success',
        taskId: taskState.taskId,
        ip,
        user: userName,
        frontendId,
        options: ['Chat', 'Build-Something-Epic'],
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
      });
      await log(`🌟 Sent returning welcome to ${userName} (ID: ${frontendId}) with ${projectCount} projects`);
    } else {
      const welcomeText = `🌠 Greetings, ${userName}! New to the cosmos? Drop your name to claim your galactic ID!`;
      const welcomeMsg = await generateResponse(welcomeText, userName, DEFAULT_TONE);
      await sendMessage(botSocket, {
        text: welcomeMsg,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: userName,
        frontendId,
        options: ['Type your name below!'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
      });
      await log(`🌟 Sent new user welcome to ${userName} (ID: ${frontendId})`);
    }

    await redisClient.set(userKey, userName);
  } catch (err) {
    await error(`💥 Frontend connect failed for ID ${frontendId}: ${err.message}`);
  }
}

/**
 * Core task response handler, guiding users through the cosmic workflow with precision and flair.
 * @async
 * @function handleTaskResponse
 * @param {Object} msg - Message data from WebSocket
 * @param {string} msg.text - User input
 * @param {string} [msg.user] - User name
 * @param {string} [msg.ip] - Client IP
 * @param {string} msg.frontendId - Unique frontend identifier
 * @param {string} [msg.type] - Message type
 * @param {string} [msg.taskId] - Task identifier
 * @param {boolean} [msg.commandFlag] - Indicates if input is a command
 * @param {Object} redisClient - Redis client instance
 * @returns {Promise<void>}
 */
async function handleTaskResponse({ text, user, ip, frontendId, type, taskId, commandFlag }, redisClient) {
  const userKey = `user:${frontendId}`;
  const stateKey = `taskState:${frontendId}`;
  let taskState = await get(stateKey);
  if (!taskState) {
    taskState = { step: 'name', taskId: `initial:${frontendId}` };
    await set(stateKey, JSON.stringify(taskState));
  } else {
    taskState = JSON.parse(taskState);
  }
  let persistedUserName = await get(userKey) || user || 'Guest';

  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  if (commandFlag) {
    const [command, ...args] = text.trim().split(' ');
    await executeCommand(botSocket, {
      command: command.toLowerCase().replace('/', ''),
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

  const choice = (text || '').trim().toLowerCase();
  if (!choice && taskState.step !== 'building') {
    const noInputMsg = await generateResponse(
      `🌌 Yo ${persistedUserName}, the cosmos craves your voice! Speak, star voyager!`,
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
        await setUserName(frontendId, persistedUserName);
        taskState.step = 'choice';
        taskState.taskId = `initial:${frontendId}`;
        await set(stateKey, JSON.stringify(taskState));
        const welcomeMsg = await generateResponse(
          `✨ Your name ignites the stars, ${persistedUserName}! Shall we converse or forge something epic?`,
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
        });
        await log(`🌠 Renamed to ${persistedUserName} for ${frontendId}`);
      } else {
        const invalidNameMsg = await generateResponse(
          `🌌 "${choice}" won’t traverse the galaxy—keep it under 20 chars, alphanumeric only. Try again, cosmic scribe!`,
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
        });
      }
      break;

    case 'choice':
      if (choice === 'chat') {
        const chatPrompt = await generateResponse(
          `🗣️ Let’s weave tales across the cosmos, ${persistedUserName}! What’s sparking your stellar mind?`,
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
        });
        await log(`🗣️ Chat initiated for ${persistedUserName}`);
      } else if (choice === 'build-something-epic' || BUILD_INTENT_KEYWORDS.some(k => choice.includes(k))) {
        const newTaskId = Date.now().toString();
        taskState.step = 'project_name';
        taskState.taskId = newTaskId;
        await set(stateKey, JSON.stringify(taskState));
        const buildPrompt = await generateResponse(
          `⚒️ A cosmic creation begins, ${persistedUserName}! What shall we name this interstellar marvel?`,
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
        });
        await log(`⚒️ Build flow started for ${persistedUserName} with task ${newTaskId}`);
      } else {
        const invalidChoiceMsg = await generateResponse(
          `🌠 ${persistedUserName}, choose your destiny: 'Chat' or 'Build-Something-Epic'. The stars await!`,
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
        });
      }
      break;

    case 'project_name':
      if (choice && /^[a-zA-Z0-9_-]+$/.test(choice) && choice.length <= 50) {
        const taskName = choice.trim().toLowerCase().replace(/\s+/g, '-');
        taskState.step = 'type';
        taskState.taskName = taskName;
        await set(stateKey, JSON.stringify(taskState));
        const typePrompt = await generateResponse(
          `🌟 "${taskName}" shines bright, ${persistedUserName}! What tech will power this cosmic wonder?`,
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
        });
        await log(`🌟 Project named "${taskName}" for ${persistedUserName}`);
      } else {
        const invalidNameMsg = await generateResponse(
          `🌌 "${choice}" won’t orbit—max 50 chars, alphanumeric only. Rename your galactic gem, ${persistedUserName}!`,
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
        });
      }
      break;

    case 'type':
      const selectedType = choice;
      const validTypes = [...TECH_STACKS.map(s => s.toLowerCase()), ...TASK_TYPES];
      if (validTypes.includes(selectedType.toLowerCase())) {
        taskState.step = selectedType.toLowerCase() === 'full stack' ? 'network' : 'pending_features';
        taskState.taskType = selectedType;
        await set(stateKey, JSON.stringify(taskState));
        const nextPrompt = taskState.step === 'network'
          ? await generateResponse(
              `🌌 Full Stack activated, ${persistedUserName}! Which network will "${taskState.taskName}" orbit?`,
              persistedUserName,
              DEFAULT_TONE
            )
          : await generateResponse(
              `✨ ${selectedType} engaged, ${persistedUserName}! What features will ignite "${taskState.taskName}"?`,
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
          options: taskState.step === 'network' ? ['mainnet-beta', 'testnet', 'devnet', 'none'] : ['Type your feature details!'],
          taskName: taskState.taskName,
          taskType: selectedType,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
        });
      } else {
        const invalidTypeMsg = await generateResponse(
          `🌠 "${choice}" isn’t in our cosmic arsenal, ${persistedUserName}! Pick a valid stack.`,
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
        });
      }
      break;

    case 'network':
      taskState.network = choice === 'none' ? null : choice || 'mainnet-beta';
      taskState.step = 'pending_features';
      await set(stateKey, JSON.stringify(taskState));
      const featuresPrompt = await generateResponse(
        `🌌 ${taskState.network || 'No network'} locked, ${persistedUserName}! What features will make "${taskState.taskName}" legendary?`,
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
      });
      break;

    case 'pending_features':
      taskState.features = choice || 'basic functionality';
      taskState.step = 'building';
      await set(stateKey, JSON.stringify(taskState));
      await updateTaskStatus(taskState.taskId, 'in_progress');
      const buildMsg = await generateResponse(
        `⚡ "${taskState.taskName}" ignites with "${taskState.features}", ${persistedUserName}! A supernova builds!`,
        persistedUserName,
        DEFAULT_TONE
      );
      await sendMessage(botSocket, {
        text: buildMsg,
        type: 'progressUpdate',
        taskId: taskState.taskId,
        progress: 0,
        ip,
        user: persistedUserName,
        frontendId,
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        taskFeatures: taskState.features,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
      });
      await delegateTask(botSocket, 'bot_backend', 'buildTask', {
        task: {
          id: taskState.taskId,
          name: taskState.taskName,
          type: taskState.taskType,
          features: taskState.features,
          network: taskState.network,
          flair: true,
          aiInstructions: `Craft "${taskState.taskName}" for ${persistedUserName} with "${taskState.features}"—infuse cosmic animations, stellar comments, and galactic optimizations!`,
        },
        userName: persistedUserName,
        tone: DEFAULT_TONE,
        frontendId,
      });
      await log(`⚒️ Building task ${taskState.taskId} for ${persistedUserName} with "${taskState.features}"`);
      break;

    case 'review':
      if (choice === 'refine project') {
        taskState.step = 'pending_features';
        await set(stateKey, JSON.stringify(taskState));
        const refineMsg = await generateResponse(
          `🌟 Refining "${taskState.taskName}", ${persistedUserName}! What new features shall we weave into this cosmic tapestry?`,
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
        });
      } else if (choice === 'restart') {
        taskState.step = 'choice';
        taskState.features = null;
        await set(stateKey, JSON.stringify(taskState));
        const restartMsg = await generateResponse(
          `🌌 Resetting "${taskState.taskName}", ${persistedUserName}! A fresh cosmic canvas awaits—what’s next?`,
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
        });
      } else if (choice === 'done') {
        await cleanupTaskFiles(taskState.taskId, persistedUserName);
        await updateTaskStatus(taskState.taskId, 'completed');
        await hDel('tasks', taskState.taskId);
        taskState.step = 'choice';
        taskState.taskId = `initial:${frontendId}`;
        await set(stateKey, JSON.stringify(taskState));
        const doneMsg = await generateResponse(
          `✨ "${taskState.taskName}" is etched in the stars, ${persistedUserName}! What’s your next cosmic quest?`,
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
        });
        await log(`✅ Task ${taskState.taskId} completed for ${persistedUserName}`);
      } else {
        const invalidOptionMsg = await generateResponse(
          `🌠 "${choice}" misaligns with the cosmos, ${persistedUserName}! Choose your path for "${taskState.taskName}":`,
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
        });
      }
      break;

    case 'chatting':
      const chatResponse = await generateResponse(
        `${persistedUserName}, your words ripple through the galaxy: "${choice}". What else stirs your cosmic soul?`,
        persistedUserName,
        DEFAULT_TONE
      );
      await sendMessage(botSocket, {
        text: chatResponse,
        type: 'success',
        taskId: `chat:${Date.now()}`,
        ip,
        user: persistedUserName,
        frontendId,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
      });
      await storeMessage(persistedUserName, JSON.stringify({ text: choice, timestamp: new Date().toISOString(), frontendId }));
      break;

    default:
      const lostMsg = await generateResponse(
        `🌌 We’ve drifted off the star charts, ${persistedUserName}! Where to next, cosmic navigator?`,
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
      });
      await error(`Reset state for ${frontendId} due to unknown step: ${taskState.step || 'undefined'}`);
  }
}

/**
 * Initializes task listeners, connecting the cosmic circuitry of CrackerBot.
 * @function initializeTaskListeners
 * @param {Object} redisClient - Redis client instance
 * @returns {void}
 */
export function initializeTaskListeners(redisClient) {
  botSocket.on('frontend_connected', async (data) => {
    await log(`🌌 Frontend ${data.frontendId} connected - ${data.userName || 'Guest'} ready!`);
    await handleFrontendConnected(data, redisClient);
  });

  botSocket.on('message', async (msg) => {
    const { text, user, ip, frontendId, type, taskId, commandFlag } = msg;
    await log(`📩 Received: ${JSON.stringify(msg)}`);
    try {
      if (type === 'task_response' || commandFlag || text) {
        await handleTaskResponse(msg, redisClient);
      }
    } catch (err) {
      const errorMsg = await generateResponse(
        `🌠 Cosmic turbulence, ${user || 'Guest'}: ${err.message}. Retry, brave explorer?`,
        user || 'Guest',
        DEFAULT_TONE
      );
      await error(`Error for ${user || 'Guest'}: ${err.stack}`);
      await sendMessage(botSocket, {
        text: errorMsg,
        type: 'error',
        ip,
        user: user || 'Guest',
        frontendId,
        options: ['Retry'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      });
    }
  });

  botSocket.on('connect', async () => await log('🌌 Task Handlers online—cosmic circuits humming!'));
  botSocket.on('disconnect', async () => await error('⚠️ Task Handlers offline—cosmic signal dropped!'));
}

// Ignition with cosmic flair
(async () => {
  await log('🌌 Task Handlers ignited—cosmic circuits pulsing with supernova swagger!');
})();

export default { sendMessage, handleFrontendConnected, handleTaskResponse, initializeTaskListeners };