// ai_coders/bot_lead/src/stateManager.js (ESM, v2025-03-28-10)
/* CrackerBot’s cosmic core—managing tasks with interstellar precision and supernova swagger! 🌌 */
import { log, error } from './logger.js';
import { set, get, hSet, hGet } from './redisClient.js';
import { botSocket } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import { v4 as uuidv4 } from 'uuid';
import { cacheCompletedTask } from './taskCache.js';

let lastGeneratedTask = null;
const processedMessages = new Set();
const pendingTaskResults = new Map();

/**
 * Sets the last generated task in memory and Redis.
 * @param {Object} task - Task data to store
 * @returns {Promise<void>}
 */
export async function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
  try {
    await set('lastGeneratedTask', task);
    await log(`Persisted lastGeneratedTask: ${task.taskId}—cosmic memory locked! 🌠`);
  } catch (err) {
    await error(`Failed to persist lastGeneratedTask ${task.taskId}: ${err.message}`);
  }
}

/**
 * Retrieves the last generated task from Redis, handling malformed data.
 * @returns {Promise<Object|null>} Last task or null if not found/invalid
 */
export async function getLastGeneratedTask() {
  try {
    const stored = await get('lastGeneratedTask');
    if (stored) {
      try {
        lastGeneratedTask = typeof stored === 'string' ? JSON.parse(stored) : stored;
        await log(`Retrieved lastGeneratedTask: ${lastGeneratedTask.taskId}—cosmic archives accessed! 🌌`);
      } catch (parseErr) {
        await error(`Malformed lastGeneratedTask data: ${parseErr.message} - resetting to null`);
        lastGeneratedTask = null;
        await set('lastGeneratedTask', null); // Clear invalid data
      }
    }
    return lastGeneratedTask;
  } catch (err) {
    await error(`Failed to get lastGeneratedTask: ${err.message}`);
    return null;
  }
}

/**
 * Updates the status of a task in Redis.
 * @param {string} taskId - Task ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
export async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await hGet('tasks', taskId);
    if (!taskData) throw new Error(`Task ${taskId} not found`);
    const task = taskData;
    task.status = status;
    await hSet('tasks', taskId, task);
    await log(`Task ${taskId} updated to status: ${status} for frontendId ${task.frontendId}—cosmic sync complete! 🚀`);
  } catch (err) {
    await error(`Failed to update task status for ${taskId}: ${err.message}`);
    throw err;
  }
}

/**
 * Emits a deduplicated message via WebSocket with cosmic flair.
 * @param {Object} message - Message payload
 * @param {Object} [socket=botSocket] - WebSocket instance
 * @returns {Promise<void>}
 */
async function emitCosmicMessage(message, socket = botSocket) {
  const messageId = message.messageId || uuidv4();
  if (processedMessages.has(messageId)) {
    await log(`Duplicate message ${messageId} skipped—cosmic efficiency in action! ✨`);
    return;
  }
  processedMessages.add(messageId);
  message.messageId = messageId;

  if (!socket.connected) {
    await error(`Socket disconnected, queuing message ${messageId} for ${message.target}`);
    pendingTaskResults.set(messageId, message);
    return;
  }

  socket.emit('message', message);
  await log(`🚀 Beamed message to ${message.target} (ID: ${message.frontendId || 'N/A'}): "${message.text}"`);
  setTimeout(() => processedMessages.delete(messageId), 60000);
}

/**
 * Delegates a task to a target bot with retries and callbacks.
 * @param {Object} botSocketArg - WebSocket instance (optional)
 * @param {string} botName - Target bot name
 * @param {string} command - Command to execute
 * @param {Object} args - Task arguments
 * @returns {Promise<Object>} Task result
 */
export async function delegateTask(botSocketArg, botName, command, args) {
  const socket = botSocketArg || botSocket;
  const frontendId = args.frontendId || socket.id;

  if (!socket.connected) {
    await error(`WebSocket not connected, cannot delegate task to ${botName} for frontendId ${frontendId}`);
    throw new Error('WebSocket not connected');
  }

  const requestId = Date.now().toString();
  const taskData = {
    type: 'message',
    commandFlag: true,
    target: botName,
    command,
    args: {
      task: {
        ...args.task,
        flair: true,
        aiInstructions: `Deeply interpret "${args.task.features}" for ${args.userName}, adding cosmic flair like animated effects, rich details, and unexpected twists!`,
      },
      userName: args.userName,
      tone: args.tone || DEFAULT_TONE,
      frontendId,
      requestId,
      leadId: socket.id,
    },
  };

  await log(`Delegating task to ${botName} with requestId ${requestId} and leadId ${socket.id}: ${JSON.stringify(taskData)}`);
  console.log(`[${new Date().toISOString()}] Emitting command as message to WebSocket server: ${JSON.stringify(taskData)}`);

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    let callbackReceived = false;

    const emitCommand = () => {
      attempts++;
      console.log(`[${new Date().toISOString()}] Attempt ${attempts}/${maxAttempts} to emit command to ${botName}, socket.connected: ${socket.connected}`);

      socket.emit('message', taskData, (ack) => {
        callbackReceived = true;
        if (ack && ack.status === 'success') {
          console.log(`[${new Date().toISOString()}] Command acknowledged by server: ${JSON.stringify(ack)}`);
          log(`Command acknowledged by server: ${JSON.stringify(ack)}`);
        } else {
          console.error(`[${new Date().toISOString()}] Command acknowledgment failed: ${JSON.stringify(ack)}`);
          if (attempts >= maxAttempts) {
            reject(new Error(`Command acknowledgment failed after ${maxAttempts} attempts: ${ack?.message || 'No response'}`));
          }
        }
      });

      if (attempts < maxAttempts && !callbackReceived) {
        setTimeout(() => {
          if (!callbackReceived) {
            console.log(`[${new Date().toISOString()}] No callback received for attempt ${attempts}, retrying...`);
            emitCommand();
          }
        }, 5000);
      }
    };

    emitCommand();

    const taskResultHandler = async (data) => {
      const messageId = `${data?.requestId}-${data?.taskId}-${data?.type || 'result'}`;
      console.log(`[${new Date().toISOString()}] Received taskResult for requestId ${data?.requestId}, messageId ${messageId}: ${JSON.stringify(data)}`);
      if (data?.requestId === requestId && !processedMessages.has(messageId)) {
        processedMessages.add(messageId);
        socket.off('taskResult', taskResultHandler);
        await processTaskResult(data, args, socket, resolve, reject);
      }
    };

    socket.off('taskResult');
    socket.on('taskResult', taskResultHandler);

    setTimeout(() => {
      if (!callbackReceived) {
        socket.off('taskResult', taskResultHandler);
        error(`Task ${command} delegation to ${botName} timed out for frontendId ${frontendId} after ${maxAttempts} attempts with requestId ${requestId}`);
        reject(new Error('Task delegation timeout after 30s'));
      }
    }, 30000);
  });
}

/**
 * Processes task result from bot_backend and caches it.
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

    await log(`Processing taskResult for ${taskId || 'unknown'} - content: ${content ? 'present' : 'null'}`);

    if (taskError || !taskId) {
      const errorMsg = await generateResponse(
        `Yo ${userName}, "${name}" hit a cosmic snag: ${taskError || 'Missing task data'}. Retry or tweak it? ⚠️`,
        userName,
        tone
      );
      await emitCosmicMessage({
        text: errorMsg,
        type: 'error',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        options: ['Retry', 'Tweak it'],
        finalContent: content,
        fileName: fileName || `${name}_error.zip`,
        downloadLink: content ? `data:application/zip;base64,${content}` : null,
        messageId: `${requestId}-${taskId}-error`,
      }, socket);
      await error(`Task failed for frontendId ${frontendId} with requestId ${requestId}: ${taskError || 'Missing task data'}`);
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
    await cacheCompletedTask(projectData); // Use taskCache.js
    await setLastGeneratedTask(projectData);

    const taskResultMsg = await generateResponse(
      `Yo ${userName}! "${name}" (${type} v${version}) just blasted out of hyperspace! Snag it, preview it, and plot your next move! 🌟`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: taskResultMsg,
      type: 'taskResult',
      taskId,
      finalContent: content,
      fileName: fileName || `${name}_v${version}.zip`,
      downloadLink: content ? `data:application/zip;base64,${content}` : null,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      taskName: name,
      taskType: type,
      taskFeatures,
      options: ['Restart', 'Refine Project', 'Done'],
      messageId: `${requestId}-${taskId}-result`,
    }, socket);

    await log(`Task ${taskId} delivered for ${userName}: ${name}—cosmic payload unleashed!`);

    const taskData = await hGet('tasks', taskId);
    if (taskData) {
      const taskObj = taskData;
      taskObj.step = 'review';
      taskObj.status = 'completed'; // Align with cacheCompletedTask
      await hSet('tasks', taskId, taskObj);
      await updateTaskStatus(taskId, 'completed');
    }

    await log(`Task completed by ${args.botName || 'bot_backend'} for frontendId ${frontendId} with requestId ${requestId}`);
    resolve(data);

    const responseHandler = async (msg) => {
      if (msg.type === 'task_response' && msg.taskId === taskId && msg.text === 'Done') {
        await updateTaskStatus(taskId, 'completed');
        await log(`Task ${taskId} finalized as completed for ${userName}—cosmic vault sealed!`);
        const successMsg = await generateResponse(
          `${userName}, "${name}" is locked in the cosmic vault! Fetch it with /projects or ignite a new supernova! 🌌`,
          userName,
          tone
        );
        await emitCosmicMessage({
          text: successMsg,
          type: 'success',
          taskId,
          from: 'CrackerBot Prime',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
          messageId: `${requestId}-${taskId}-success`,
        }, socket);
        socket.off('message', responseHandler);
      }
    };

    socket.off('message', responseHandler);
    socket.on('message', responseHandler);
  } catch (err) {
    await error(`Error handling taskResult for requestId ${data?.requestId}: ${err.message}`);
    const errorMsg = await generateResponse(
      `Yo ${args.userName || 'Guest'}, "${data?.name || 'unknown'}" hit a cosmic snag: ${err.message}. Retry or tweak it? ⚠️`,
      args.userName || 'Guest',
      args.tone || DEFAULT_TONE
    );
    await emitCosmicMessage({
      text: errorMsg,
      type: 'error',
      taskId: data?.taskId || 'unknown',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip: data?.ip || 'unknown',
      user: args.userName || 'Guest',
      frontendId: data?.frontendId || args.frontendId,
      options: ['Retry', 'Tweak it'],
      finalContent: data?.content,
      fileName: data?.fileName || `${data?.name || 'unknown'}_error.zip`,
      downloadLink: data?.content ? `data:application/zip;base64,${data.content}` : null,
      messageId: `${data?.requestId}-${data?.taskId || 'unknown'}-error`,
    }, socket);
    reject(err);
  }
}

/**
 * Initializes WebSocket listeners for state management.
 */
export function initializeStateManager() {
  botSocket.on('connect', async () => {
    await log('StateManager connected—cosmic channels blazing! 🌌');
    for (const [messageId, message] of pendingTaskResults) {
      if (botSocket.connected) {
        botSocket.emit('message', message);
        await log(`🚀 Sent queued message ${messageId} to ${message.target}`);
        pendingTaskResults.delete(messageId);
      }
    }
  });

  botSocket.on('disconnect', async () => await error('StateManager disconnected—cosmic signal lost! ⚠️'));

  botSocket.on('taskResult', async (data) => {
    await log(`Received taskResult from bot_backend: ${JSON.stringify(data)}`);
    const task = await hGet('tasks', data.taskId);
    if (task) {
      const args = {
        userName: task.user,
        tone: DEFAULT_TONE,
        frontendId: task.frontendId,
        botName: 'bot_backend',
      };
      await processTaskResult(data, args, botSocket, () => {}, () => {});
    } else {
      await error(`No task found for taskId ${data.taskId} in Redis`);
    }
  });

  botSocket.on('message', async (data) => {
    const messageId = `${data?.requestId || data?.taskId || Date.now()}-${data?.type || 'unknown'}-${data?.text?.slice(0, 50) || 'no-text'}`;
    if (processedMessages.has(messageId)) {
      await log(`Duplicate message ${messageId} skipped—cosmic efficiency rocks! ✨`);
      return;
    }

    if (data.type === 'progressUpdate' && data.taskId) {
      await log(`Relaying progressUpdate for taskId ${data.taskId}: ${data.progress}% - ${data.text}`);
      await emitCosmicMessage({
        ...data,
        from: data.from || 'CrackerBot Prime',
        target: 'bot_frontend',
        messageId,
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
      await cacheCompletedTask(projectData); // Use taskCache.js
      await updateTaskStatus(taskId, 'completed');
      await log(`Stored project:${user}:${taskId} in Redis—cosmic vault sealed!`);
      await emitCosmicMessage({
        text: `"${taskName}" locked in the cosmic vault for ${user}! Fetch with /projects or start a new supernova! 🌌`,
        type: 'success',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user,
        frontendId,
        taskName,
        taskType,
        taskFeatures,
        messageId: `${taskId}-store-success`,
      }, botSocket);
    }

    // Handle AI suggestion requests from PreviewPopup
    if (data.commandFlag && data.text.toLowerCase().includes('enhance this') && data.taskId && data.fileName) {
      const { taskId, user, frontendId, ip, fileName } = data;
      await log(`Processing AI suggestion request for ${fileName} (taskId: ${taskId})`);
      const suggestion = await generateResponse(data.text, user, DEFAULT_TONE);
      await emitCosmicMessage({
        type: 'ai_suggestion',
        taskId,
        fileName,
        suggestion,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        frontendId,
        ip,
        user,
        messageId: `${taskId}-${fileName}-suggestion`,
      }, botSocket);
      await log(`Emitted AI suggestion for ${fileName}: ${suggestion.substring(0, 50)}...`);
    }
  });
}

(async () => {
  try {
    await log('stateManager.js v2025-03-28-10 loaded with supernova precision');
    const stored = await getLastGeneratedTask();
    if (stored) {
      await log(`Loaded lastGeneratedTask from Redis: ${stored.taskId}—cosmic sync restored!`);
    }
    initializeStateManager();
  } catch (err) {
    await error(`Failed to initialize stateManager: ${err.message}`);
  }
})();

export { lastGeneratedTask };