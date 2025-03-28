// ai_coders/bot_lead/src/taskHandlers.js (ESM, v2025-03-28-4)
/**
 * Task Handlers Module
 * Orchestrates CrackerBot’s cosmic task flow with supernova precision, welcoming users,
 * and handling multi-step tasks with interstellar flair.
 *
 * @version 2025-03-28-4
 * @author CrackerBot Team, enhanced by xAI
 */

import { log, error } from './logger.js';
import { redisClient, get, set, hGet, hSet, hDel } from './redisClient.js';
import { delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';
import { getCompletedProjects } from './taskCache.js';
import { executeCommand } from './commands/index.js'; // Import the orchestrator

const TECH_STACKS = ['Full Stack', 'MEAN', 'MERN', 'LAMP', 'JAMstack'];
const TASK_TYPES = Object.keys(extensionMap)
  .filter((ext) => !TECH_STACKS.map((s) => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter((ext) => ext !== 'zip');

/**
 * Sends a message via WebSocket with cosmic flair.
 * @param {Object} botSocket - Socket.IO instance.
 * @param {Object} message - Message payload.
 */
export async function sendMessage(botSocket, message) {
  const {
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
    messageId,
  } = message;
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
    messageId: messageId || `${taskId || Date.now()}-${type}`,
  };
  botSocket.emit('message', msgData);
  await log(`🚀 Beamed cosmic message to ${target} for ${user} (ID: ${frontendId}): "${text}"`);
}

/**
 * Signals bot_backend to clean up temporary task files.
 * @param {Object} botSocket - Socket.IO instance.
 * @param {string} taskId - Task ID to clean up.
 * @param {string} userName - User requesting cleanup.
 */
async function cleanupTaskFiles(botSocket, taskId, userName) {
  await botSocket.emit('command', {
    command: 'cleanupTask',
    args: { taskId, userName },
    target: 'bot_backend',
  });
  await log(`Signaled cleanup for taskId ${taskId} to bot_backend for ${userName}`);
}

/**
 * Handles frontend connection with a supernova welcome.
 * @param {Object} botSocket - Socket.IO instance.
 * @param {Object} data - Connection data from WebSocket.
 */
async function handleFrontendConnected(botSocket, data) {
  const { frontendId, userName: initialName, ip } = data;
  const userKey = `user:${frontendId}`;
  const stateKey = `taskState:${frontendId}`;
  const tone = DEFAULT_TONE;

  // Persist or retrieve user name
  let userName = await get(userKey) || initialName || 'Guest';
  if (!await get(userKey)) {
    await set(userKey, userName);
  }
  const taskId = `initial_name:${frontendId}`;

  // Set initial task state
  await set(stateKey, { step: 'name', taskId });

  if (userName === 'Guest') {
    const welcomeMsg = await generateResponse(
      `Yo, cosmic traveler! You’ve landed in CrackerBot’s galaxy—name yourself to join the crew! 🌌`,
      userName,
      tone
    );
    await sendMessage(botSocket, {
      text: welcomeMsg,
      type: 'question',
      taskId,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      options: ['Type your name below!'],
    });
    await log(`New user detected (ID: ${frontendId})—sent supernova welcome to ${userName}!`);
  } else {
    const returningMsg = await generateResponse(
      `Welcome back, ${userName}! The cosmos missed your vibe—ready to ignite some epicness? 🚀`,
      userName,
      tone
    );
    await set(stateKey, { step: 'choice', taskId });
    await sendMessage(botSocket, {
      text: returningMsg,
      type: 'success',
      taskId,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      options: ['Chat', 'Build-Something-Epic'],
    });
    await log(`Returning user ${userName} (ID: ${frontendId})—reignited with cosmic greeting!`);
  }
}

/**
 * Core task response handler with multi-step flow and cosmic vibes.
 * @param {Object} botSocket - Socket.IO instance.
 * @param {string} taskId - Task ID.
 * @param {string} answer - User input.
 * @param {string} userName - User name.
 * @param {string} tone - Response tone.
 * @param {string} ip - User IP.
 * @param {string} userInfoKey - Redis key for user info.
 * @param {string} frontendId - Frontend ID.
 * @param {string} stateKey - Redis key for task state.
 * @param {Object} taskState - Current task state.
 * @param {boolean} commandFlag - Indicates if input is a command.
 */
export async function handleTaskResponse(
  botSocket,
  taskId,
  answer,
  userName,
  tone = DEFAULT_TONE,
  ip,
  userInfoKey,
  frontendId,
  stateKey,
  taskState,
  commandFlag
) {
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  // Persist user name in Redis
  const userKey = `user:${frontendId}`;
  let persistedUserName = await get(userKey);
  if (!persistedUserName) {
    persistedUserName = userName || 'Guest';
    await set(userKey, persistedUserName);
  } else if (userName && userName !== 'Guest' && userName !== persistedUserName) {
    await set(userKey, userName);
    persistedUserName = userName;
  }

  if (commandFlag) {
    const commandText = answer || '';
    const commandParts = commandText.trim().split(' ');
    const command = commandParts[0].toLowerCase().replace('/', ''); // Remove leading '/'
    const args = commandParts.length > 1 ? commandParts.slice(1).join(' ') : undefined;

    await executeCommand(botSocket, {
      command,
      frontendId,
      user: persistedUserName,
      tone,
      ip,
      taskId,
      userKey,
      stateKey,
    }, redisClient);

    return; // Exit after handling command
  }

  const choice = answer?.trim().toLowerCase();
  if (!choice) {
    const errorMsg = await generateResponse(
      `Yo ${persistedUserName}, you gotta give me something to warp with! What’s your next move, star? 🤔`,
      persistedUserName,
      tone
    );
    await sendMessage(botSocket, {
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: persistedUserName,
      frontendId,
    });
    return;
  }

  if (taskId.startsWith('chat:')) {
    let userInfo = (await get(userInfoKey)) || {};
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `Yo ${persistedUserName}, "${answer}" as your tech soulmate? Lit choice! 🔥 What’s the dream project you’d unleash with it?`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: nextQuestion,
        type: 'question',
        taskId: `chat:${Date.now()}`,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        frontendId,
      });
    } else if (!userInfo.dreamProject) {
      userInfo.dreamProject = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `"${answer}"? That’s a vibe, ${persistedUserName}! 🌟 What’s your coding superpower to make it legendary?`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: nextQuestion,
        type: 'question',
        taskId: `chat:${Date.now()}`,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        frontendId,
      });
    } else {
      userInfo.superpower = answer;
      await set(userInfoKey, userInfo);
      const chatEnd = await generateResponse(
        `${persistedUserName}, you’re a cosmic force! With ${userInfo.favoriteTech}, "${userInfo.dreamProject}", and "${answer}" as your superpower, we’re unstoppable! 🚀 What’s next, maestro?`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: chatEnd,
        type: 'success',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        options: ['Chat', 'Build-Something-Epic'],
        frontendId,
      });
    }
    return;
  }

  const task = (await hGet('tasks', taskId)) || { user: persistedUserName };
  let stateUpdate;

  switch (taskState.step) {
    case 'name':
      const newName = answer.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(`user:${frontendId}`, newName);
        persistedUserName = newName;
        taskState.step = 'choice';
        await set(stateKey, taskState);
        const welcome = await generateResponse(
          `Locked in, ${persistedUserName}! I’m CrackerBot Prime, your cosmic co-pilot with mad skills. What’s brewing in that genius dome? 🎸`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: welcome,
          type: 'success',
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Chat', 'Build-Something-Epic'],
          taskId: taskState.taskId,
          frontendId,
        });
        await log(`Renamed to ${persistedUserName} for frontendId ${frontendId}—welcome vibes dropped!`);
      } else {
        const errorMsg = await generateResponse(
          `Yo ${persistedUserName}, "${answer}" ain’t cutting it—max 20 chars, alphanumeric with _ or -, retry that jam! What’s your name, star?`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'question',
          taskId: taskState.taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Type your name below!'],
          frontendId,
        });
      }
      break;

    case 'choice':
      if (choice === 'build-something-epic') {
        const newTaskId = Date.now().toString();
        await hSet('tasks', newTaskId, { taskId: newTaskId, step: 'project_name', user: persistedUserName, status: 'pending', frontendId });
        stateUpdate = { step: 'project_name', taskId: newTaskId };
        await set(stateKey, stateUpdate);
        const namePrompt = await generateResponse(
          `${persistedUserName}, Epic Build Mode engaged! Let’s forge a legend—what’s this masterpiece called? 🌌`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: namePrompt,
          type: 'question',
          taskId: newTaskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Name your project!'],
          frontendId,
        });
        await log(`Kicked off task ${newTaskId} for ${persistedUserName}—naming phase initiated!`);
      } else if (choice === 'chat') {
        const chatPrompt = await generateResponse(
          `${persistedUserName}, Chat Mode online! Let’s riff—what’s sparking your cosmic circuits today? 🎤`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: chatPrompt,
          type: 'question',
          taskId: `chat:${Date.now()}`,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          frontendId,
        });
        await log(`Chat vibes flowing for ${persistedUserName}!`);
      } else {
        const errorMsg = await generateResponse(
          `Hold up ${persistedUserName}, "${answer}" ain’t on the radar! Pick "Chat" or "Build-Something-Epic"—what’s your move?`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'question',
          taskId: taskState.taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Chat', 'Build-Something-Epic'],
          frontendId,
        });
      }
      break;

    case 'project_name':
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, '-');
        task.step = 'type';
        task.status = 'pending';
        await hSet('tasks', taskId, task);
        stateUpdate = { step: 'type', taskId };
        await set(stateKey, stateUpdate);
        const typePrompt = await generateResponse(
          `Sweet, ${persistedUserName}! "${task.name}" is in the zone. Pick your flavor—tech stacks are bold and ready to roll! 🚀`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: typePrompt,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: [...TECH_STACKS.map((stack) => ({ text: stack, style: 'large' })), ...TASK_TYPES.map((type) => ({ text: type, style: 'normal' }))],
          frontendId,
          taskName: task.name,
          taskFeatures: task.features || 'Pending',
        });
      } else {
        const errorMsg = await generateResponse(
          `Nope ${persistedUserName}, "${answer}" ain’t vibing—max 50 chars, alphanumeric with _ or -, try again! What’s the name?`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Name your project!'],
          frontendId,
          taskName: task.name,
          taskFeatures: task.features || 'Pending',
        });
      }
      break;

    case 'type':
      const selectedType = answer?.trim().toLowerCase();
      const validTypes = [...TECH_STACKS.map((s) => s.toLowerCase()), ...TASK_TYPES];
      if (!validTypes.includes(selectedType)) {
        const errorMsg = await generateResponse(
          `Whoa ${persistedUserName}, "${answer}" ain’t in the stack! Pick a type or tech from the lineup!`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: [...TECH_STACKS.map((stack) => ({ text: stack, style: 'large' })), ...TASK_TYPES.map((type) => ({ text: type, style: 'normal' }))],
          frontendId,
          taskName: task.name,
          taskFeatures: task.features || 'Pending',
        });
        break;
      }
      task.type = selectedType;
      task.step = selectedType === 'full stack' ? 'network' : 'pending_features';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: task.step, taskId };
      await set(stateKey, stateUpdate);
      const nextPrompt =
        task.type === 'full stack'
          ? await generateResponse(`${persistedUserName}, Full Stack activated! What network’s powering this beast? 🌐`, persistedUserName, tone)
          : await generateResponse(
              `${persistedUserName}, ${task.type.toUpperCase()} in the bag! What features are we cranking into "${task.name}"? 💥`,
              persistedUserName,
              tone
            );
      await sendMessage(botSocket, {
        text: nextPrompt,
        type: 'question',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        options: task.type === 'full stack' ? ['mainnet-beta', 'testnet', 'devnet', 'none'] : ['Type your feature details!'],
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features || 'Pending',
      });
      break;

    case 'network':
      task.network = choice === 'none' ? null : choice || 'mainnet-beta';
      task.step = 'pending_features';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: 'pending_features', taskId };
      await set(stateKey, stateUpdate);
      const featuresPrompt = await generateResponse(
        `${persistedUserName}, ${task.network || 'no network'} locked! What features are we stacking into "${task.name}" to make it epic? 🎨`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: featuresPrompt,
        type: 'question',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        options: ['Type your feature details!'],
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features || 'Pending',
      });
      break;

    case 'pending_features':
      task.features = task.features ? `${task.features}, ${answer?.trim()}` : answer?.trim() || 'basic functionality';
      task.step = 'building';
      task.status = 'in_progress';
      const existingProjects = await getCompletedProjects(persistedUserName);
      const sameNameProjects = existingProjects.filter((p) => p.name === task.name);
      task.version = sameNameProjects.length + 1;
      await hSet('tasks', taskId, task);
      stateUpdate = { step: 'building', taskId };
      await set(stateKey, stateUpdate);
      await updateTaskStatus(taskId, 'in_progress');

      await log(`Captured features for task ${taskId}: "${task.features}"`);

      await sendMessage(botSocket, {
        text: `Igniting the warp drive for "${task.name}", ${persistedUserName}! Features: "${task.features}"—hold tight! 🌌`,
        type: 'progressUpdate',
        taskId,
        progress: 0,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });

      const startMsg = await generateResponse(
        `Firing up "${task.name}" v${task.version}, ${persistedUserName}! Buckle up—we’re blasting into hyperspace with features: "${task.features}"! 🚀`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: startMsg,
        type: 'info',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });
      await log(`Task ${taskId} kicked into build mode for ${persistedUserName} with features: "${task.features}"`);

      const previousProject = await get(`project:${persistedUserName}:${taskId}`);
      await delegateTask(botSocket, 'bot_backend', 'buildTask', {
        task: {
          ...task,
          previousContent: previousProject ? previousProject.content : null,
          flair: true,
          aiInstructions: `Deeply interpret "${task.features}" for ${persistedUserName}, adding cosmic flair like animated effects, rich details, and unexpected twists!`,
        },
        userName: persistedUserName,
        tone,
        frontendId,
      });
      break;

    case 'review':
      if (choice === 'refine project') {
        task.step = 'pending_features';
        task.status = 'pending';
        await hSet('tasks', taskId, task);
        stateUpdate = { step: 'pending_features', taskId };
        await set(stateKey, stateUpdate);
        const previousProject = await get(`project:${persistedUserName}:${taskId}`);
        const refinePrompt = await generateResponse(
          `${persistedUserName}, time to amp up "${task.name}"! What extra features are we stacking to make this beast even better? ⚡️`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: refinePrompt,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Type your additional features!'],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
          previousContent: previousProject ? previousProject.content : null,
        });
      } else if (choice === 'restart') {
        task.step = 'choice';
        task.status = 'pending_restart';
        task.features = null;
        await hSet('tasks', taskId, task);
        stateUpdate = { step: 'choice', taskId };
        await set(stateKey, stateUpdate);
        const restartPrompt = await generateResponse(
          `${persistedUserName}, wiping the slate on "${task.name}"! Fresh start, new spark—Chat or Build-Something-Epic? 🎬`,
          persistedUserName,
          tone
        );
        await redisClient.del('lastGeneratedTask');
        await sendMessage(botSocket, {
          text: restartPrompt,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Chat', 'Build-Something-Epic'],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: null,
        });
      } else if (choice === 'done') {
        await log(`Finalizing task ${taskId} as 'Done' for ${persistedUserName} with name: ${task.name}`);
        await cleanupTaskFiles(botSocket, taskId, persistedUserName);
        await updateTaskStatus(taskId, 'completed');
        await hDel('tasks', taskId);
        stateUpdate = { step: 'choice', taskId: `initial_name:${frontendId}` };
        await set(stateKey, stateUpdate);
      } else {
        const errorMsg = await generateResponse(
          `${persistedUserName}, "${answer}" ain’t a valid move for "${task.name}"! Pick from the cosmic playbook—what’s next?`,
          persistedUserName,
          tone
        );
        await sendMessage(botSocket, {
          text: errorMsg,
          type: 'question',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: persistedUserName,
          options: ['Restart', 'Refine Project', 'Done'],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
        });
      }
      break;

    default:
      const lostMsg = await generateResponse(
        `Lost in space on "${taskId}", ${persistedUserName}! Where we warping next? 🌠`,
        persistedUserName,
        tone
      );
      await sendMessage(botSocket, {
        text: lostMsg,
        type: 'error',
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: persistedUserName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features || 'Pending',
      });
      await error(`Unknown task state for ${taskId}: ${taskState.step}`);
  }
}

/**
 * Initializes task listeners with cosmic precision.
 * @param {Object} botSocket - Socket.IO instance.
 */
export function initializeTaskListeners(botSocket) {
  botSocket.on('frontend_connected', (data) => handleFrontendConnected(botSocket, data));
  botSocket.on('message', async (msg) => {
    const { text, user, userId, ip, frontendId, type, taskId, commandFlag } = msg;
    await log(`CrackerBot Prime snagged a hot one: ${JSON.stringify(msg)} - let’s roll!`);
    const userInfoKey = `userInfo:${userId || frontendId}`;
    const stateKey = `taskState:${frontendId}`;
    let taskState = await get(stateKey);
    if (!taskState) {
      taskState = { step: 'name', taskId: `initial_name:${frontendId}` };
      await set(stateKey, taskState);
    }
    if (type === 'task_response' || commandFlag) {
      await handleTaskResponse(
        botSocket,
        taskId || taskState.taskId,
        text,
        user || 'Guest',
        DEFAULT_TONE,
        ip,
        userInfoKey,
        frontendId,
        stateKey,
        taskState,
        commandFlag
      );
    }
  });
  botSocket.on('connect', async () => await log('Task Handlers connected—cosmic channels live! 🌌'));
  botSocket.on('disconnect', async () => await error('Task Handlers disconnected—cosmic signal lost! ⚠️'));
}

export default { sendMessage, handleTaskResponse, initializeTaskListeners };