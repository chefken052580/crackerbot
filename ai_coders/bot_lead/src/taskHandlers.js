// bot_lead/src/taskHandlers.js
// Version: v2025-07-29-14
/**
 * Task Handlers Module
 * Manages CrackerBot’s task flow, handling user resets, new guests, and returning users.
 * Clears user and cache on /warp_reconnect, prompts for new guest name, and offers
 * Chat or Build-Something-Epic. Welcomes back returning users with options.
 * Enhanced by xAI for robust Redis caching, session handling, race condition prevention,
 * stricter reconnection throttling, early welcomeSent check, fixed /warp_reconnect handling,
 * and enhanced deduplication to prevent multiple name prompts.
 *
 * @version 2025-07-29-14
 * @author CrackerBot Team, enhanced by xAI
 * @module taskHandlers
 */

import { log, error } from './logger.js';
import { redisClient, set, get, hGet, hSet, hDel, storeMessage, del, keys, sAdd, sMembers } from './redisClient.js';
import { botSocketPromise } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import handleResetName from './commands/reset_name.js';

let debounceTimers = {};
let recentMessages = {};

/**
 * Validates JSON string.
 * @param {string} str - String to validate
 * @returns {boolean} True if valid JSON
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a message is a duplicate based on recent messages.
 * @param {string} frontendId - Frontend ID
 * @param {string} text - Message text
 * @param {string} taskId - Task ID
 * @returns {boolean} True if message is a duplicate
 */
async function isDuplicateMessage(frontendId, text, taskId) {
  const messageKey = `recentMessage:${frontendId}:${taskId}`;
  const recent = await get(messageKey);
  if (recent && recent.includes(text.slice(0, 100))) {
    await log(`Duplicate message detected for ${frontendId}, taskId ${taskId}: ${text.slice(0, 100)}...`, { frontendId, taskId });
    return true;
  }
  await set(messageKey, text, 120); // Increased TTL to 120s
  return false;
}

/**
 * Sends a message via WebSocket with cosmic styling.
 * @async
 * @param {Object} socket - WebSocket instance
 * @param {Object} message - Message data
 * @param {string} message.text - Message content
 * @param {string} [message.type='bot'] - Message type
 * @param {string} [message.taskId] - Task ID
 * @param {string} [message.from='CrackerBot Prime'] - Sender
 * @param {string} [message.target='frontend'] - Target
 * @param {string} [message.ip] - IP address
 * @param {string} [message.user] - User name
 * @param {string} [message.frontendId] - Frontend ID
 * @param {string[]} [message.options] - Response options
 * @param {string} [message.messageId] - Unique message ID
 * @param {Object} [message.bubbleStyle] - Style for UI bubble
 * @returns {Promise<void>}
 */
export async function sendMessage(socket, message) {
  const {
    text,
    type = 'bot',
    taskId,
    from = 'CrackerBot Prime',
    target = 'frontend',
    ip,
    user,
    frontendId,
    options,
    messageId,
    bubbleStyle = { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
  } = message;

  if (!frontendId || !taskId) {
    await error(`Missing frontendId or taskId in sendMessage: frontendId=${frontendId || 'missing'}, taskId=${taskId || 'missing'}`, { taskId });
    return;
  }

  if (await isDuplicateMessage(frontendId, text, taskId)) {
    await log(`Skipping duplicate message for ${frontendId}: ${text.slice(0, 100)}...`, { taskId, frontendId });
    return;
  }

  const userString = /^[a-zA-Z0-9_-]{1,20}$/.test(user) ? user : 'Guest';
  const msgData = {
    text,
    type,
    taskId,
    from,
    target,
    ip: ip || 'unknown',
    user: userString,
    frontendId,
    options,
    messageId: messageId || `${taskId}-${type}-${Date.now()}`,
    bubbleStyle: { background: bubbleStyle.background, color: bubbleStyle.color },
    timestamp: new Date().toISOString(),
  };

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (!socket.connected) throw new Error('WebSocket not connected');
      await log(`Sending message to ${target} for ${userString} (ID: ${frontendId}): ${text.slice(0, 100)}...`, { taskId });
      socket.emit('message', msgData);
      await log(`Message sent successfully to ${target} for ${userString} (ID: ${frontendId})`, { taskId });
      await storeMessage(userString, msgData);
      return;
    } catch (err) {
      attempt++;
      await error(`Failed to send message, attempt ${attempt}/${maxRetries}: ${err.message}`, { taskId });
      if (attempt === maxRetries) throw new Error(`Failed to send message after ${maxRetries} attempts: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Acquires a lock for a frontend to prevent race conditions.
 * @async
 * @param {string} frontendId - Frontend ID
 * @param {number} timeout - Lock timeout in seconds
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<boolean>} True if lock acquired
 */
async function acquireLock(frontendId, timeout = 20, retries = 5, delay = 200) {
  const lockKey = `lock:${frontendId}`;
  let attempt = 0;

  while (attempt < retries) {
    const lockSet = await redisClient.set(lockKey, 'true', { NX: true, EX: timeout });
    if (lockSet === 'OK') {
      await log(`Lock acquired for ${frontendId} on attempt ${attempt + 1}`, { frontendId });
      return true;
    }
    attempt++;
    await log(`Lock acquisition attempt ${attempt}/${retries} failed for ${frontendId}, retrying in ${delay}ms`, { frontendId });
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  await error(`Failed to acquire lock for ${frontendId} after ${retries} attempts`, { frontendId });
  return false;
}

/**
 * Releases a lock for a frontend.
 * @async
 * @param {string} frontendId - Frontend ID
 * @returns {Promise<void>}
 */
async function releaseLock(frontendId) {
  const lockKey = `lock:${frontendId}`;
  await redisClient.del(lockKey);
  await log(`Released lock for ${frontendId}`, { frontendId });
}

/**
 * Clears Redis cache for a frontend.
 * @async
 * @param {string} frontendId - Frontend ID
 * @param {string} sessionId - Session ID
 * @param {string} userName - User name
 * @returns {Promise<void>}
 */
async function clearCache(frontendId, sessionId, userName) {
  const projectKeys = await redisClient.keys(`project:${userName}:*`);
  if (projectKeys.length > 0) await redisClient.del(projectKeys);
  await del(`user:${frontendId}`);
  await del(`taskState:${frontendId}`);
  await del(`welcomeSent:${frontendId}`);
  await del(`last_connected:${frontendId}`);
  await del(`reconnectCount:${frontendId}`);
  await del(`recentMessage:${frontendId}:*`);
  await del(`sessionLock:${frontendId}`);
  if (sessionId) await del(`session:${sessionId}`);
  const pendingTasks = await redisClient.hKeys('pendingTasks');
  for (const taskId of pendingTasks) {
    const task = await hGet('pendingTasks', taskId);
    if (task && isValidJSON(task) && JSON.parse(task).frontendId === frontendId) await hDel('pendingTasks', taskId);
  }
  const tasks = await redisClient.hKeys('tasks');
  for (const taskId of tasks) {
    const task = await hGet('tasks', taskId);
    if (task && isValidJSON(task) && JSON.parse(task).frontendId === frontendId) await hDel('tasks', taskId);
  }
  await log(`Cleared Redis cache for frontendId: ${frontendId}, user: ${userName}`, { frontendId });
}

/**
 * Debounces function calls for a frontend to prevent duplicates.
 * @param {string} frontendId - Frontend ID
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(frontendId, fn, delay = 3000) {
  return (...args) => {
    if (debounceTimers[frontendId]) clearTimeout(debounceTimers[frontendId]);
    debounceTimers[frontendId] = setTimeout(() => {
      fn(...args);
      delete debounceTimers[frontendId];
    }, delay);
  };
}

/**
 * Handles new frontend connections, welcoming new or returning users.
 * @async
 * @param {Object} data - Connection data
 * @param {string} data.ip - IP address
 * @param {string} data.frontendId - Frontend ID
 * @param {string} [data.userName] - Initial user name
 * @param {string} [data.sessionId] - Session ID
 * @returns {Promise<void>}
 */
export async function handleFrontendConnected({ ip, frontendId, userName: initialName, sessionId }) {
  const socket = await botSocketPromise;
  try {
    if (!frontendId || !sessionId) {
      await error(`Invalid connection data: frontendId=${frontendId || 'missing'}, sessionId=${sessionId || 'missing'}`, { frontendId });
      return;
    }

    if (!await acquireLock(frontendId)) {
      await log(`Lock acquisition failed for ${frontendId}, skipping handleFrontendConnected`, { frontendId, sessionId });
      return;
    }

    await log(`🌌 Frontend connected: frontendId=${frontendId}, userName=${initialName || 'Guest'}, sessionId=${sessionId}, ip=${ip}`, { frontendId, sessionId });
    const stateKey = `taskState:${frontendId}`;
    const userKey = `user:${frontendId}`;
    const sessionKey = `session:${sessionId}`;
    const welcomeKey = `welcomeSent:${frontendId}`;
    const lastConnectedKey = `last_connected:${frontendId}`;
    const reconnectCountKey = `reconnectCount:${frontendId}`;
    const sessionLockKey = `sessionLock:${frontendId}`;
    const welcomeLockKey = `welcomeLock:${frontendId}`;

    // Early check for welcomeSent to prevent duplicate prompts
    const welcomeSent = await get(welcomeKey);
    if (welcomeSent === 'true') {
      await log(`Welcome already sent for ${frontendId}, checking user state`, { frontendId, sessionId });
      const userData = await get(userKey);
      if (userData && isValidJSON(userData)) {
        const persistedUserName = JSON.parse(userData).name;
        if (persistedUserName && /^[a-zA-Z0-9_-]{1,20}$/.test(persistedUserName)) {
          await log(`Returning user ${persistedUserName} detected, skipping prompt`, { frontendId, sessionId });
          await releaseLock(frontendId);
          return;
        }
      }
    }

    // Stricter reconnection throttling
    const now = Date.now();
    const lastConnected = await get(lastConnectedKey);
    const reconnectCount = parseInt(await get(reconnectCountKey) || '0');
    const existingSessionId = await get(sessionLockKey);

    if (existingSessionId && existingSessionId !== sessionId) {
      await log(`Session ID mismatch for ${frontendId}: existing=${existingSessionId}, new=${sessionId}, rejecting`, { frontendId, sessionId });
      await sendMessage(socket, {
        text: `Cosmic session conflict detected! Please refresh to realign.`,
        type: 'error',
        ip,
        user: initialName || 'Guest',
        frontendId,
        taskId: `error:${Date.now()}`,
        options: ['Retry'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `error-session-${Date.now()}`,
      });
      await releaseLock(frontendId);
      return;
    }

    if (lastConnected && now - parseInt(lastConnected) < 15000) { // Increased to 15s
      if (reconnectCount > 2) {
        await log(`Excessive reconnections (${reconnectCount}) for ${frontendId}, rejecting`, { frontendId, sessionId });
        await sendMessage(socket, {
          text: `Cosmic turbulence detected! Too many reconnections—please wait a moment.`,
          type: 'error',
          ip,
          user: initialName || 'Guest',
          frontendId,
          taskId: `error:${Date.now()}`,
          options: ['Retry'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `error-reconnect-${Date.now()}`,
        });
        await releaseLock(frontendId);
        return;
      }
      await set(reconnectCountKey, reconnectCount + 1, 300);
      await log(`Recent connection for ${frontendId} within 15s, skipping (reconnect count: ${reconnectCount + 1})`, { frontendId, sessionId });
      await releaseLock(frontendId);
      return;
    }

    await set(lastConnectedKey, now, 86400);
    await set(reconnectCountKey, '0', 300);
    await set(sessionLockKey, sessionId, 86400);

    // Retrieve user name
    let persistedUserName;
    const userData = await get(userKey);
    if (userData && isValidJSON(userData)) {
      persistedUserName = JSON.parse(userData).name;
    } else if (userData) {
      await del(userKey);
      await log(`Cleared corrupted user data for ${frontendId}`, { frontendId });
    }

    // Determine effective user name
    const effectiveUserName = /^[a-zA-Z0-9_-]{1,20}$/.test(initialName) ? initialName :
      /^[a-zA-Z0-9_-]{1,20}$/.test(persistedUserName) ? persistedUserName : 'Guest';

    await log(`Effective user name: ${effectiveUserName}, initialName: ${initialName}, persistedUserName: ${persistedUserName}`, { frontendId, sessionId });

    const taskId = `initial:${frontendId}`;
    if (effectiveUserName !== 'Guest' && welcomeSent === 'true') {
      const storedProjects = await sMembers(`completedProjects:${effectiveUserName}`);
      const projectCount = storedProjects.length;
      const welcomeText = projectCount > 0
        ? `Welcome back, ${effectiveUserName}! Your ${projectCount} stellar creation${projectCount === 1 ? '' : 's'} await—what’s next? 🌌✨`
        : `Welcome back, ${effectiveUserName}! Ready to ignite the cosmos? 🌌✨`;
      const debouncedSend = debounce(frontendId, async () => {
        await sendMessage(socket, {
          text: welcomeText,
          taskId,
          ip,
          user: effectiveUserName,
          frontendId,
          type: 'success',
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
          messageId: `welcome-${effectiveUserName}-${Date.now()}`,
        });
        await set(stateKey, JSON.stringify({ step: 'choice', taskId, user: effectiveUserName }));
        await set(sessionKey, JSON.stringify({ step: 'choice', taskId, user: effectiveUserName }));
        await set(welcomeKey, 'true', 86400);
        await log(`🌟 Beamed welcome to returning client ${effectiveUserName} (ID: ${frontendId})`, { frontendId, taskId });
      }, 3000);
      debouncedSend();
    } else {
      const lockSet = await redisClient.set(welcomeLockKey, 'true', { NX: true, EX: 30 });
      if (!lockSet) {
        await log(`Skip sending welcome prompt for ${frontendId}, welcome lock exists`, { frontendId, taskId });
        await releaseLock(frontendId);
        return;
      }

      const welcomeText = await generateResponse(
        `🌌 Galactic gates open, star voyager! Name yourself to claim your cosmic legacy!`,
        'Guest',
        DEFAULT_TONE,
        { taskId }
      );
      const debouncedSend = debounce(frontendId, async () => {
        await sendMessage(socket, {
          text: welcomeText,
          taskId,
          ip,
          user: 'Guest',
          frontendId,
          type: 'question',
          options: ['Type your name below!'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
          messageId: `welcome-Guest-${taskId}-${Date.now()}`,
        });
        await set(stateKey, JSON.stringify({ step: 'name', taskId, user: 'Guest' }));
        await set(sessionKey, JSON.stringify({ step: 'name', taskId, user: 'Guest' }));
        await set(welcomeKey, 'true', 86400);
        await redisClient.del(welcomeLockKey);
        await log(`🌟 Beamed single welcome to new client (ID: ${frontendId})`, { frontendId, taskId });
      }, 3000);
      debouncedSend();
    }
    await releaseLock(frontendId);
  } catch (err) {
    await error(`Frontend connect error for ${frontendId}: ${err.message}`, { frontendId });
    const errorText = await generateResponse(
      `Cosmic static, ${initialName || 'Guest'}! Connection error: ${err.message}. Retry, star voyager?`,
      initialName || 'Guest',
      DEFAULT_TONE,
      { taskId: taskId || 'error' }
    );
    await sendMessage(socket, {
      text: errorText,
      type: 'error',
      ip,
      user: initialName || 'Guest',
      frontendId,
      taskId: taskId || `error:${Date.now()}`,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `error-${Date.now()}`,
    });
    await releaseLock(frontendId);
  }
}

/**
 * Processes user task responses and handles commands.
 * @async
 * @param {Object} message - Message data
 * @param {string} message.text - User input
 * @param {string} message.user - User name
 * @param {string} message.ip - IP address
 * @param {string} message.frontendId - Frontend ID
 * @param {string} message.type - Message type
 * @param {string} message.taskId - Task ID
 * @param {boolean} message.commandFlag - Is it a command?
 * @param {string} message.sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function handleTaskResponse(message) {
  const socket = await botSocketPromise;
  const { text, user, ip, frontendId, type, taskId, commandFlag, sessionId } = message || {};

  if (!frontendId || !taskId || !sessionId) {
    await error(`Invalid message in handleTaskResponse: frontendId=${frontendId || 'missing'}, taskId=${taskId || 'missing'}, sessionId=${sessionId || 'missing'}, text=${text || 'no text'}, user=${user || 'no user'}, ip=${ip || 'no ip'}, type=${type || 'no type'}, commandFlag=${commandFlag}`, { taskId });
    const errorText = await generateResponse(
      `Cosmic static detected! Invalid message data. Please reconnect.`,
      user || 'Guest',
      DEFAULT_TONE,
      { taskId: taskId || 'error' }
    );
    await sendMessage(socket, {
      text: errorText,
      type: 'error',
      ip,
      user: user || 'Guest',
      frontendId: frontendId || 'unknown',
      taskId: taskId || `error:${Date.now()}`,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `error-${Date.now()}`,
    });
    return;
  }

  if (!await acquireLock(frontendId)) {
    await log(`Lock acquisition failed for ${frontendId}, skipping handleTaskResponse`, { frontendId, taskId });
    return;
  }

  try {
    await log(`📩 Raw task response: text=${text || 'no text'}, user=${user || 'no user'}, ip=${ip || 'no ip'}, frontendId=${frontendId}, type=${type || 'no type'}, taskId=${taskId}, commandFlag=${commandFlag}, sessionId=${sessionId}`, { taskId, frontendId });

    const userKey = `user:${frontendId}`;
    const stateKey = `taskState:${frontendId}`;
    const sessionKey = `session:${sessionId}`;
    const welcomeKey = `welcomeSent:${frontendId}`;
    const sessionLockKey = `sessionLock:${frontendId}`;

    // Validate session
    const existingSessionId = await get(sessionLockKey);
    if (existingSessionId && existingSessionId !== sessionId) {
      await log(`Session ID mismatch for ${frontendId}: existing=${existingSessionId}, new=${sessionId}, rejecting`, { frontendId, sessionId });
      await sendMessage(socket, {
        text: `Cosmic session conflict detected! Please refresh to realign.`,
        type: 'error',
        ip,
        user: user || 'Guest',
        frontendId,
        taskId: `error:${Date.now()}`,
        options: ['Retry'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `error-session-${Date.now()}`,
      });
      await releaseLock(frontendId);
      return;
    }

    let taskState;
    const storedState = await get(sessionKey) || await get(stateKey);
    taskState = storedState && isValidJSON(storedState) ? JSON.parse(storedState) : { step: 'name', taskId: `initial:${frontendId}`, user: 'Guest' };
    if (storedState && !isValidJSON(storedState)) {
      await del(sessionKey);
      await del(stateKey);
      await log(`Cleared corrupted taskState for ${frontendId}`, { frontendId });
      taskState = { step: 'name', taskId: `initial:${frontendId}`, user: 'Guest' };
    }

    let persistedUserName = user || taskState.user || 'Guest';
    const userData = await get(userKey);
    if (userData && isValidJSON(userData)) {
      persistedUserName = JSON.parse(userData).name || persistedUserName;
    } else if (userData) {
      await del(userKey);
      await log(`Cleared corrupted user data for ${frontendId}`, { frontendId });
    }

    if (type === 'task_response' || commandFlag) {
      await socket.emit('typing', { target: 'frontend', frontendId, ip, sessionId });
      await log(`📩 Emitted typing for ${persistedUserName} (ID: ${frontendId}): "${text}"`, { taskId, frontendId });
    }

    if (commandFlag) {
      const commandText = text.trim().toLowerCase();
      const command = commandText.split(' ')[0].replace('/', '');
      if (command === 'warp_reconnect') {
        await handleResetName(socket, persistedUserName, DEFAULT_TONE, ip, frontendId, taskId, userKey, stateKey, sessionId, redisClient);
        await clearCache(frontendId, sessionId, persistedUserName);
        await releaseLock(frontendId);
        return;
      }
      // Other commands (commands, projects)
      const commandList = ['/warp_reconnect', '/commands', '/projects'].map(cmd => `${cmd}: ${cmd === '/warp_reconnect' ? 'Reset user identity' : cmd === '/commands' ? 'List commands' : 'View projects'}`);
      if (command === 'commands') {
        await sendMessage(socket, {
          text: `🌟 Cosmic Command Codex:\n${commandList.join('\n')}`,
          type: 'system',
          ip,
          user: persistedUserName,
          frontendId,
          taskId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#333' },
          messageId: `${taskId}-commands-${Date.now()}`,
        });
      } else if (command === 'projects') {
        const storedProjects = await sMembers(`completedProjects:${persistedUserName}`);
        const projects = storedProjects.map(project => ({
          text: project,
          status: 'completed',
          options: ['Refine Project', 'Download', 'Delete'],
          taskId: project,
        }));
        await sendMessage(socket, {
          text: storedProjects.length > 0 ? `Your cosmic creations: ${storedProjects.length} project(s) found!` : 'No projects found in the cosmic archives.',
          type: 'success',
          ip,
          user: persistedUserName,
          frontendId,
          taskId,
          projects,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
          messageId: `${taskId}-projects-${Date.now()}`,
        });
      } else {
        const unknownText = await generateResponse(
          `🌌 Unknown command "${command}", ${persistedUserName}! Try /commands to see the cosmic codex.`,
          persistedUserName,
          DEFAULT_TONE,
          { taskId }
        );
        await sendMessage(socket, {
          text: unknownText,
          type: 'error',
          ip,
          user: persistedUserName,
          frontendId,
          taskId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskId}-unknown-command-${Date.now()}`,
        });
        await log(`Unknown command "${command}" from ${persistedUserName} (ID: ${frontendId})`, { taskId });
      }
      await releaseLock(frontendId);
      return;
    }

    const choice = text?.trim() || '';
    if (!choice) {
      const noInputText = await generateResponse(
        `🌌 Speak, ${persistedUserName}! The galaxy hungers for your cosmic command!`,
        persistedUserName,
        DEFAULT_TONE,
        { taskId }
      );
      await sendMessage(socket, {
        text: noInputText,
        type: 'error',
        ip,
        user: persistedUserName,
        frontendId,
        taskId,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `${taskId}-no-input-${Date.now()}`,
      });
      await releaseLock(frontendId);
      return;
    }

    switch (taskState.step) {
      case 'name':
        if (choice && /^[a-zA-Z0-9_-]+$/.test(choice) && choice.length <= 20) {
          persistedUserName = choice;
          await set(userKey, JSON.stringify({ name: persistedUserName }));
          taskState.step = 'choice';
          taskState.taskId = `initial:${frontendId}`;
          taskState.user = persistedUserName;
          await set(stateKey, JSON.stringify(taskState));
          await set(sessionKey, JSON.stringify(taskState));
          const welcomeText = await generateResponse(
            `✨ Galactic gates open, ${persistedUserName}! Forge your legend in the stars! 🌟🚀`,
            persistedUserName,
            DEFAULT_TONE,
            { taskId: taskState.taskId }
          );
          const debouncedSend = debounce(frontendId, async () => {
            await sendMessage(socket, {
              text: welcomeText,
              type: 'success',
              taskId: taskState.taskId,
              ip,
              user: persistedUserName,
              frontendId,
              options: ['Chat', 'Build-Something-Epic'],
              bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
              messageId: `welcome-${persistedUserName}-${Date.now()}`,
            });
          }, 3000);
          debouncedSend();
          await set(welcomeKey, 'true', 86400);
          await log(`🌠 Christened ${persistedUserName} for ${frontendId} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId, frontendId });
        } else {
          const invalidNameText = await generateResponse(
            `🌌 "${choice}" won’t orbit—max 20 chars, alphanumeric only. Retry, cosmic namer!`,
            persistedUserName,
            DEFAULT_TONE,
            { taskId }
          );
          await sendMessage(socket, {
            text: invalidNameText,
            type: 'question',
            taskId,
            ip,
            user: persistedUserName,
            frontendId,
            options: ['Type your name below!'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
            messageId: `welcome-${persistedUserName}-${taskId}-${Date.now()}`,
          });
        }
        break;

      case 'choice':
        const choiceLower = choice.toLowerCase();
        if (choiceLower === 'chat' || choiceLower === 'build-something-epic') {
          const actionText = choiceLower === 'chat'
            ? `🗣️ Cosmic comms online, ${persistedUserName}! What’s your next query?`
            : `⚒️ Ready to build something epic, ${persistedUserName}? Let’s forge a cosmic creation!`;
          await sendMessage(socket, {
            text: actionText,
            type: 'success',
            taskId: `${choiceLower}:${Date.now()}`,
            ip,
            user: persistedUserName,
            frontendId,
            bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
            messageId: `${choiceLower}-${Date.now()}`,
          });
          taskState.step = choiceLower === 'chat' ? 'chatting' : 'building';
          await set(stateKey, JSON.stringify(taskState));
          await set(sessionKey, JSON.stringify(taskState));
          await log(`${choiceLower === 'chat' ? 'Chat' : 'Build'} initiated for ${persistedUserName} (ID: ${frontendId})`, { taskId });
        } else {
          const invalidChoiceText = await generateResponse(
            `🌠 ${persistedUserName}, align your orbit: 'Chat' or 'Build-Something-Epic'. The stars await!`,
            persistedUserName,
            DEFAULT_TONE,
            { taskId }
          );
          await sendMessage(socket, {
            text: invalidChoiceText,
            type: 'question',
            taskId,
            ip,
            user: persistedUserName,
            frontendId,
            options: ['Chat', 'Build-Something-Epic'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
            messageId: `${taskId}-choice-retry-${Date.now()}`,
          });
        }
        break;

      case 'chatting':
        const chatResponse = await generateResponse(
          `${persistedUserName}, your echo: "${choice}". What’s next in our cosmic colloquy?`,
          persistedUserName,
          DEFAULT_TONE,
          { taskId: `chat:${Date.now()}` }
        );
        await sendMessage(socket, {
          text: chatResponse,
          type: 'success',
          taskId: `chat:${Date.now()}`,
          ip,
          user: persistedUserName,
          frontendId,
          bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
          messageId: `chat-${Date.now()}`,
        });
        taskState.lastChatPrompt = choice;
        await set(stateKey, JSON.stringify(taskState));
        await set(sessionKey, JSON.stringify(taskState));
        await log(`🗣️ Cosmic banter beamed for ${persistedUserName} (ID: ${frontendId})`, { taskId });
        break;

      default:
        const lostText = await generateResponse(
          `🌌 We’ve veered into the void, ${persistedUserName}! Realign your cosmic compass—where to next?`,
          persistedUserName,
          DEFAULT_TONE,
          { taskId: `initial:${frontendId}` }
        );
        taskState.step = 'choice';
        taskState.taskId = `initial:${frontendId}`;
        await set(stateKey, JSON.stringify(taskState));
        await set(sessionKey, JSON.stringify(taskState));
        await sendMessage(socket, {
          text: lostText,
          type: 'error',
          ip,
          user: persistedUserName,
          frontendId,
          taskId: `initial:${frontendId}`,
          options: ['Chat', 'Build-Something-Epic'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskId}-reset-${Date.now()}`,
        });
        await log(`Reset orbit for ${frontendId} from unknown step: ${taskState.step || 'undefined'} - Warped to step: ${taskState.step}`, { taskId: taskState.taskId, frontendId });
    }
    await releaseLock(frontendId);
  } catch (err) {
    await error(`Task response error for ${frontendId}: ${err.message}`, { frontendId, taskId });
    const errorText = await generateResponse(
      `Cosmic static, ${user || 'Guest'}! Error: ${err.message}. Retry, star voyager?`,
      user || 'Guest',
      DEFAULT_TONE,
      { taskId: taskId || 'error' }
    );
    await sendMessage(socket, {
      text: errorText,
      type: 'error',
      ip,
      user: user || 'Guest',
      frontendId,
      taskId: taskId || `error:${Date.now()}`,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `error-${Date.now()}`,
    });
    await releaseLock(frontendId);
  }
}

/**
 * Initializes WebSocket listeners for task handling.
 * @async
 */
export async function initializeTaskListeners() {
  try {
    const socket = await botSocketPromise;
    await log('🌌 taskHandlers.js v2025-07-29-14 igniting with supernova precision!', { taskId: 'init' });

    socket.on('frontend_connected', async (data) => {
      await log(`📩 Received frontend_connected: frontendId=${data.frontendId}, userName=${data.userName || 'Guest'}, sessionId=${data.sessionId}, ip=${data.ip}`, { frontendId: data.frontendId });
      await handleFrontendConnected(data);
    });

    socket.on('message', async (data) => {
      try {
        if (Array.isArray(data)) {
          await log(`Skipping array message to prevent double processing: ${JSON.stringify(data)}`, { taskId: data[0]?.taskId });
          return;
        }
        await log(`📩 Received message: frontendId=${data.frontendId || 'no frontendId'}, user=${data.user || 'no user'}, text=${data.text?.slice(0, 100) || 'no text'}..., type=${data.type || 'no type'}, taskId=${data.taskId || 'no taskId'}, commandFlag=${data.commandFlag}`, { taskId: data.taskId, frontendId: data.frontendId });
        if (!data.frontendId || !data.taskId) {
          await error(`Missing frontendId or taskId in received message: type=${data.type || 'no type'}, taskId=${data.taskId || 'no taskId'}, frontendId=${data.frontendId || 'no frontendId'}`, { taskId: data.taskId });
          const errorText = await generateResponse(
            `Stellar glitch, ${data.user || 'Guest'}: Missing message data. Retry, cosmic pioneer?`,
            data.user || 'Guest',
            DEFAULT_TONE,
            { taskId: data.taskId || 'error' }
          );
          await sendMessage(socket, {
            text: errorText,
            type: 'error',
            ip: data.ip || 'unknown',
            user: data.user || 'Guest',
            frontendId: data.frontendId || 'unknown',
            taskId: data.taskId || `error:${Date.now()}`,
            options: ['Retry'],
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
            messageId: `error-${Date.now()}`,
          });
          return;
        }
        if (data.type === 'task_response' || data.commandFlag) {
          await handleTaskResponse(data);
        }
      } catch (err) {
        const fallbackFrontendId = data.frontendId || 'unknown';
        const fallbackUser = data.user || 'Guest';
        const fallbackTaskId = data.taskId || `error:${Date.now()}`;
        await error(`Cosmic error for ${fallbackUser}: ${err.message}`, { taskId: fallbackTaskId, frontendId: fallbackFrontendId });
        const errorText = await generateResponse(
          `Stellar glitch, ${fallbackUser}: ${err.message}. Retry, cosmic pioneer?`,
          fallbackUser,
          DEFAULT_TONE,
          { taskId: fallbackTaskId }
        );
        await sendMessage(socket, {
          text: errorText,
          type: 'error',
          ip: data.ip || 'unknown',
          user: fallbackUser,
          frontendId: fallbackFrontendId,
          taskId: fallbackTaskId,
          options: ['Retry'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `error-${Date.now()}`,
        });
      }
    });

    socket.on('connect', async () => {
      await log('🌌 Task Handlers online—cosmic circuits blazing!', { taskId: 'init' });
    });

    socket.on('disconnect', async () => {
      await error('⚠️ Task Handlers offline—cosmic signal faded!', { taskId: 'init' });
    });

    socket.on('error', async (err) => {
      await error(`WebSocket error: ${err.message}`, { taskId: 'init' });
    });

    await log('🌌 taskHandlers.js fully ignited—cosmic listeners online!', { taskId: 'init' });
  } catch (err) {
    await error(`taskHandlers.js supernova-failed: ${err.message}`, { taskId: 'init' });
    throw err;
  }
}

(async () => {
  try {
    await log('🌌 Task Handlers v2025-07-29-14 ablaze—cosmic circuits pulsing!', { taskId: 'init' });
    await initializeTaskListeners();
  } catch (err) {
    await error(`Task Handlers initialization failed: ${err.message}`, { taskId: 'init' });
    process.exit(1);
  }
})();