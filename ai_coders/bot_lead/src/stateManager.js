// ai_coders/bot_lead/src/stateManager.js (ESM, v2025-04-01-12)
/**
 * CrackerBot’s Cosmic Core Module
 * Manages tasks and messages with interstellar precision and supernova swagger!
 * Enhanced by xAI for robustness, flair, and cosmic connectivity.
 *
 * @version 2025-04-01-12
 * @author CrackerBot Team, enhanced by xAI
 * @module stateManager
 */

import { log, error } from './logger.js';
import { set, get, hSet, hGet } from './redisClient.js';
import { botSocket } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import { v4 as uuidv4 } from 'uuid';
import { cacheCompletedTask } from './taskCache.js';

// In-memory state with cosmic persistence
let lastGeneratedTask = null;
const processedMessages = new Set();
const pendingTaskResults = new Map();

/**
 * Sets the last generated task in memory and Redis with cosmic permanence.
 * @async
 * @function setLastGeneratedTask
 * @param {Object} task - Task data to store
 * @param {string} task.taskId - Unique task identifier
 * @returns {Promise<void>}
 */
export async function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
  try {
    await set('lastGeneratedTask', JSON.stringify(task));
    await log(`🌠 Last task ${task.taskId} etched in cosmic memory—galactic sync locked!`);
  } catch (err) {
    await error(`⚠️ Failed to persist lastGeneratedTask ${task.taskId}: ${err.message}`);
  }
}

/**
 * Retrieves the last generated task from Redis, handling cosmic anomalies.
 * @async
 * @function getLastGeneratedTask
 * @returns {Promise<Object|null>} Last task or null if not found/invalid
 */
export async function getLastGeneratedTask() {
  try {
    const stored = await get('lastGeneratedTask');
    if (stored) {
      lastGeneratedTask = JSON.parse(stored);
      await log(`🌌 Retrieved last task ${lastGeneratedTask.taskId} from cosmic archives—stellar sync restored!`);
      return lastGeneratedTask;
    }
    return null;
  } catch (err) {
    await error(`⚠️ Failed to fetch lastGeneratedTask: ${err.message}`);
    return null;
  }
}

/**
 * Updates the status of a task in Redis with galactic precision.
 * @async
 * @function updateTaskStatus
 * @param {string} taskId - Task ID
 * @param {string} status - New status (e.g., 'pending', 'in_progress', 'completed')
 * @returns {Promise<void>}
 */
export async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await hGet('tasks', taskId);
    if (!taskData) throw new Error(`Task ${taskId} vanished from the cosmic ledger!`);
    const task = JSON.parse(taskData);
    task.status = status;
    await hSet('tasks', taskId, JSON.stringify(task));
    await log(`🚀 Task ${taskId} status warped to ${status} for frontendId ${task.frontendId}—cosmic sync complete!`);
  } catch (err) {
    await error(`⚠️ Failed to update task status for ${taskId}: ${err.message}`);
    throw err;
  }
}

/**
 * Emits a deduplicated message via WebSocket with supernova flair and precise routing.
 * @async
 * @function emitCosmicMessage
 * @param {Object} message - Message payload
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
 * @param {Object} [message.bubbleStyle] - Custom bubble styling
 * @param {Object} [socket=botSocket] - WebSocket instance
 * @returns {Promise<void>}
 */
export async function emitCosmicMessage(message, socket = botSocket) {
  const messageId = message.messageId || `${message.taskId || Date.now()}-${uuidv4()}`;
  if (processedMessages.has(messageId)) {
    await log(`✨ Message ${messageId} already beamed—cosmic efficiency triumphs!`);
    return;
  }

  const enhancedMessage = {
    ...message,
    messageId,
    from: message.from || 'CrackerBot Prime',
    target: message.target || 'bot_frontend',
    timestamp: new Date().toISOString(),
  };

  if (!socket.connected) {
    await error(`⚠️ Socket offline—queuing message ${messageId} for ${enhancedMessage.target}`);
    pendingTaskResults.set(messageId, enhancedMessage);
    return;
  }

  socket.emit('message', enhancedMessage);
  processedMessages.add(messageId);
  await log(`🌌 Warped message to ${enhancedMessage.target} (ID: ${enhancedMessage.frontendId}): "${enhancedMessage.text}"`);
  setTimeout(() => processedMessages.delete(messageId), 60000); // Clear after 1 minute
}

/**
 * Delegates a task to a target bot with retries and cosmic callbacks.
 * @async
 * @function delegateTask
 * @param {Object} botSocketArg - WebSocket instance (optional)
 * @param {string} botName - Target bot name (e.g., 'bot_backend')
 * @param {string} command - Command to execute (e.g., 'buildTask')
 * @param {Object} args - Task arguments
 * @param {Object} args.task - Task details
 * @param {string} args.userName - User name
 * @param {string} args.frontendId - Unique frontend identifier
 * @param {string} [args.tone] - Response tone
 * @returns {Promise<Object>} Task result
 */
export async function delegateTask(botSocketArg, botName, command, args) {
  const socket = botSocketArg || botSocket;
  const frontendId = args.frontendId;

  if (!socket.connected) {
    await error(`⚠️ WebSocket signal lost—cannot delegate task to ${botName} for frontendId ${frontendId}`);
    throw new Error('WebSocket not connected');
  }

  const requestId = uuidv4();
  const taskData = {
    type: 'message',
    commandFlag: true,
    target: botName,
    command,
    args: {
      task: {
        ...args.task,
        flair: true,
        aiInstructions: `Forge "${args.task.name}" for ${args.userName} with "${args.task.features}"—infuse cosmic animations, stellar comments, and galactic optimizations!`,
      },
      userName: args.userName,
      tone: args.tone || DEFAULT_TONE,
      frontendId,
      requestId,
      leadId: socket.id,
    },
  };

  await log(`🚀 Delegating task to ${botName} with requestId ${requestId} for frontendId ${frontendId}: ${JSON.stringify(taskData)}`);

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    let callbackReceived = false;

    const emitCommand = async () => {
      attempts++;
      await log(`🌠 Attempt ${attempts}/${maxAttempts} to emit command to ${botName}, socket.connected: ${socket.connected}`);

      socket.emit('message', taskData, (ack) => {
        callbackReceived = true;
        if (ack && ack.status === 'success') {
          log(`✅ Command acknowledged by server: ${JSON.stringify(ack)}`);
        } else {
          error(`⚠️ Command acknowledgment failed: ${JSON.stringify(ack)}`);
          if (attempts >= maxAttempts) {
            reject(new Error(`Command failed after ${maxAttempts} attempts: ${ack?.message || 'No response'}`));
          }
        }
      });

      if (attempts < maxAttempts && !callbackReceived) {
        setTimeout(emitCommand, 5000);
      }
    };

    emitCommand();

    const taskResultHandler = async (data) => {
      const messageId = `${data?.requestId}-${data?.taskId}-${data?.type || 'result'}`;
      if (data?.requestId === requestId && !processedMessages.has(messageId)) {
        socket.off('taskResult', taskResultHandler);
        await processTaskResult(data, args, socket, resolve, reject);
      }
    };

    socket.off('taskResult');
    socket.on('taskResult', taskResultHandler);

    setTimeout(() => {
      if (!callbackReceived) {
        socket.off('taskResult', taskResultHandler);
        error(`⚠️ Task ${command} to ${botName} timed out for frontendId ${frontendId} after ${maxAttempts} attempts with requestId ${requestId}`);
        reject(new Error('Task delegation timeout after 30s'));
      }
    }, 30000);
  });
}

/**
 * Processes task result from bot_backend and caches it with cosmic flair.
 * @async
 * @function processTaskResult
 * @param {Object} data - Task result data
 * @param {Object} args - Original task arguments
 * @param {Object} socket - WebSocket instance
 * @param {Function} resolve - Promise resolve
 * @param {Function} reject - Promise reject
 * @returns {Promise<void>}
 */
async function processTaskResult(data, args, socket, resolve, reject) {
  try {
    const {
      taskId = null,
      content = null,
      fileName = null,
      type = 'html',
      name = 'unknown',
      frontendId = args.frontendId,
      ip = 'unknown',
      taskFeatures = 'unknown',
      version = 1,
      error: taskError = null,
    } = data || {};
    const userName = args.userName || 'Guest';
    const tone = args.tone || DEFAULT_TONE;
    const requestId = data.requestId;

    await log(`🌟 Processing taskResult for ${taskId || 'unknown'}—content: ${content ? 'stellar payload received!' : 'no payload detected'}`);

    if (taskError || !taskId) {
      const errorMsg = await generateResponse(
        `🌠 Yo ${userName}, "${name}" hit a cosmic rift: ${taskError || 'Missing task data'}. Retry or refine, star voyager?`,
        userName,
        tone
      );
      await emitCosmicMessage({
        text: errorMsg,
        type: 'error',
        taskId,
        ip,
        user: userName,
        frontendId,
        options: ['Retry', 'Tweak it'],
        finalContent: content,
        fileName: fileName || `${name}_error.zip`,
        downloadLink: content ? `data:application/zip;base64,${content}` : null,
        messageId: `${requestId}-${taskId}-error`,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      }, socket);
      await error(`⚠️ Task failed for frontendId ${frontendId} with requestId ${requestId}: ${taskError || 'Missing task data'}`);
      reject(new Error(taskError || 'Invalid task data'));
      return;
    }

    const projectData = {
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName: fileName || `${name}_v${version}.zip`,
      content,
      user: userName,
      features: taskFeatures,
      version,
    };
    const cachedProject = await cacheCompletedTask(projectData);
    if (!cachedProject) throw new Error('Failed to cache project in cosmic vault');
    await setLastGeneratedTask(projectData);

    const taskResultMsg = await generateResponse(
      `✨ Yo ${userName}! "${name}" (${type} v${version}) has warped into existence—snag it, preview it, or chart your next cosmic course!`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: taskResultMsg,
      type: 'taskResult',
      taskId,
      finalContent: content,
      fileName: projectData.fileName,
      downloadLink: `data:application/zip;base64,${content}`,
      ip,
      user: userName,
      frontendId,
      taskName: name,
      taskType: type,
      taskFeatures,
      options: ['Restart', 'Refine Project', 'Done'],
      messageId: `${requestId}-${taskId}-result`,
      bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff', animation: 'pulse 1s infinite' },
    }, socket);

    await log(`🚀 Task ${taskId} unleashed for ${userName}: ${name}—cosmic payload delivered!`);

    const taskData = await hGet('tasks', taskId);
    if (taskData) {
      const taskObj = JSON.parse(taskData);
      taskObj.step = 'review';
      taskObj.status = 'completed';
      await hSet('tasks', taskId, JSON.stringify(taskObj));
      await updateTaskStatus(taskId, 'completed');
    }

    resolve(data);

    const responseHandler = async (msg) => {
      if (msg.type === 'task_response' && msg.taskId === taskId && msg.text.toLowerCase() === 'done') {
        await updateTaskStatus(taskId, 'completed');
        const successMsg = await generateResponse(
          `🌟 ${userName}, "${name}" is locked in the galactic archives! Fetch it with /projects or ignite a new supernova!`,
          userName,
          tone
        );
        await emitCosmicMessage({
          text: successMsg,
          type: 'success',
          taskId,
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
          options: ['Chat', 'Build-Something-Epic'],
          messageId: `${requestId}-${taskId}-success`,
          bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#000' },
        }, socket);
        socket.off('message', responseHandler);
      }
    };

    socket.off('message', responseHandler);
    socket.on('message', responseHandler);
  } catch (err) {
    await error(`⚠️ TaskResult for requestId ${data?.requestId} crashed: ${err.message}`);
    const errorMsg = await generateResponse(
      `🌠 Yo ${args.userName || 'Guest'}, "${data?.name || 'unknown'}" hit a cosmic snag: ${err.message}. Retry or tweak it, star pilot?`,
      args.userName || 'Guest',
      tone
    );
    await emitCosmicMessage({
      text: errorMsg,
      type: 'error',
      taskId: data?.taskId || 'unknown',
      ip: data?.ip || 'unknown',
      user: args.userName || 'Guest',
      frontendId,
      options: ['Retry', 'Tweak it'],
      finalContent: data?.content,
      fileName: data?.fileName || `${data?.name || 'unknown'}_error.zip`,
      downloadLink: data?.content ? `data:application/zip;base64,${data.content}` : null,
      messageId: `${data?.requestId}-${data?.taskId || 'unknown'}-error`,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    }, socket);
    reject(err);
  }
}

/**
 * Initializes WebSocket listeners for state management with cosmic precision.
 * @function initializeStateManager
 * @returns {void}
 */
export function initializeStateManager() {
  /**
   * Listens for WebSocket connection events, re-emitting queued messages.
   * @event connect
   * @listens botSocket#connect
   */
  botSocket.on('connect', async () => {
    await log('🌌 StateManager online—cosmic channels blazing with supernova energy!');
    for (const [messageId, message] of pendingTaskResults) {
      if (botSocket.connected) {
        await emitCosmicMessage(message, botSocket);
        pendingTaskResults.delete(messageId);
      }
    }
  });

  /**
   * Listens for WebSocket disconnection events, logging signal loss.
   * @event disconnect
   * @listens botSocket#disconnect
   */
  botSocket.on('disconnect', async () => await error('⚠️ StateManager offline—cosmic signal lost in the void!'));

  /**
   * Listens for task result events from bot_backend, processing with flair.
   * @event taskResult
   * @param {Object} data - Task result data
   * @listens botSocket#taskResult
   */
  botSocket.on('taskResult', async (data) => {
    await log(`🌟 TaskResult received from bot_backend: ${JSON.stringify(data)}`);
    const task = await hGet('tasks', data.taskId);
    if (task) {
      const taskObj = JSON.parse(task);
      const args = {
        userName: taskObj.user,
        tone: DEFAULT_TONE,
        frontendId: taskObj.frontendId,
      };
      await processTaskResult(data, args, botSocket, () => {}, () => {});
    } else {
      await error(`⚠️ Task ${data.taskId} not found in cosmic ledger—lost in hyperspace!`);
    }
  });

  /**
   * Listens for incoming WebSocket messages, handling progress, storage, and enhancements.
   * @event message
   * @param {Object} data - Message data
   * @listens botSocket#message
   */
  botSocket.on('message', async (data) => {
    const messageId = `${data?.requestId || data?.taskId || Date.now()}-${data?.type || 'unknown'}-${data?.text?.slice(0, 50) || 'no-text'}`;
    if (processedMessages.has(messageId)) {
      await log(`✨ Message ${messageId} already processed—cosmic efficiency rocks!`);
      return;
    }

    if (data.type === 'progressUpdate' && data.taskId) {
      await emitCosmicMessage({
        ...data,
        messageId,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
      }, botSocket);
    }

    if (data.commandFlag && data.text === 'store_project' && data.taskId) {
      const { taskId, user, frontendId, ip, taskName, taskType, taskFeatures, finalContent } = data;
      const projectData = {
        taskId,
        frontendId,
        ip,
        name: taskName,
        type: taskType,
        fileName: `${taskName}.zip`,
        content: finalContent,
        user,
        features: taskFeatures,
        version: 1,
      };
      const cachedProject = await cacheCompletedTask(projectData);
      if (!cachedProject) throw new Error('Failed to cache project');
      await updateTaskStatus(taskId, 'completed');
      const successMsg = await generateResponse(
        `🌟 "${taskName}" is sealed in the cosmic vault, ${user}! Fetch it with /projects or spark a new adventure!`,
        user,
        DEFAULT_TONE
      );
      await emitCosmicMessage({
        text: successMsg,
        type: 'success',
        taskId,
        ip,
        user,
        frontendId,
        taskName,
        taskType,
        taskFeatures,
        options: ['Chat', 'Build-Something-Epic'],
        messageId: `${taskId}-store-success`,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ccff, #0066ff)', color: '#fff' },
      }, botSocket);
    }

    if (data.commandFlag && data.text.toLowerCase().includes('enhance this') && data.taskId && data.fileName) {
      const { taskId, user, frontendId, ip, fileName } = data;
      const suggestion = await generateResponse(
        `✨ Enhancing "${fileName}" for ${user}: ${data.text}—adding cosmic flair and stellar upgrades!`,
        user,
        DEFAULT_TONE
      );
      await emitCosmicMessage({
        type: 'ai_suggestion',
        taskId,
        fileName,
        suggestion,
        ip,
        user,
        frontendId,
        messageId: `${taskId}-${fileName}-suggestion`,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff99cc, #ff33ff)', color: '#fff' },
      }, botSocket);
    }
  });
}

// Ignition sequence with cosmic flair
(async () => {
  try {
    await log('🌌 stateManager.js v2025-04-01-12 ignited with supernova precision!');
    const stored = await getLastGeneratedTask();
    if (stored) {
      await log(`🌟 Loaded last task ${stored.taskId} from cosmic vault—sync restored!`);
    }
    initializeStateManager();
  } catch (err) {
    await error(`⚠️ StateManager ignition failed: ${err.message}`);
  }
})();

export { lastGeneratedTask };