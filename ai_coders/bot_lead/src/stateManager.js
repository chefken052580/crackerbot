/**
 * CrackerBot’s Cosmic Core Module
 * Manages tasks and messages with interstellar precision and supernova swagger!
 * Enhanced by xAI for robust sync, flair, galactic connectivity, and error resilience.
 *
 * @version 2025-04-11-05
 * @author CrackerBot Team, enhanced by xAI
 * @module stateManager
 */

import { log, error } from './logger.js';
import { set, get, hSet, hGet, hDel } from './redisClient.js';
import { botSocket } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import { v4 as uuidv4 } from 'uuid';
import { cacheCompletedTask } from './taskCache.js';

// In-memory state with cosmic persistence
let lastGeneratedTask = null;
const processedMessages = new Set();
const pendingTaskResults = new Map();
const pendingTasksQueue = new Map(); // In-memory queue for tasks awaiting bot_backend

/**
 * Sets the last generated task in memory and Redis with cosmic permanence.
 * @async
 * @param {Object} task - Task data to store
 * @param {string} task.taskId - Unique task identifier
 * @returns {Promise<void>}
 */
export async function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
  try {
    await set('lastGeneratedTask', JSON.stringify(task));
    await log(`🌠 Last task ${task.taskId} etched in cosmic memory—galactic sync locked!`, { taskId: task.taskId });
  } catch (err) {
    await error(`⚠️ Failed to persist lastGeneratedTask ${task.taskId}: ${err.message}`, { taskId: task.taskId });
  }
}

/**
 * Retrieves the last generated task from Redis, handling cosmic anomalies.
 * @async
 * @returns {Promise<Object|null>} Last task or null if not found/invalid
 */
export async function getLastGeneratedTask() {
  try {
    const stored = await get('lastGeneratedTask');
    if (!stored) {
      await log('🌌 No lastGeneratedTask found in cosmic vault—starting fresh!');
      return null;
    }
    const parsed = JSON.parse(stored);
    await log(`🌌 Retrieved last task ${parsed.taskId} from cosmic archives—stellar sync restored!`, { taskId: parsed.taskId });
    lastGeneratedTask = parsed;
    return parsed;
  } catch (err) {
    await error(`⚠️ Failed to parse lastGeneratedTask: ${err.message}—cosmic data corrupted, resetting to null`);
    lastGeneratedTask = null;
    return null;
  }
}

/**
 * Updates the status of a task in Redis with galactic precision.
 * @async
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
    await log(`🚀 Task ${taskId} status warped to ${status} for frontendId ${task.frontendId}—cosmic sync complete!`, { taskId });
  } catch (err) {
    await error(`⚠️ Failed to update task status for ${taskId}: ${err.message}`, { taskId });
    throw err;
  }
}

/**
 * Emits a deduplicated message via WebSocket with supernova flair and precise routing.
 * @async
 * @param {Object} message - Message payload
 * @param {string} message.text - Message content
 * @param {string} [message.type] - Message type (e.g., 'question', 'success', 'progressUpdate', 'taskResult')
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
 * @param {string} [message.finalContent] - Final task content (base64)
 * @param {string} [message.fileName] - File name
 * @param {string} [message.downloadLink] - Download URL
 * @param {Object} [message.jsonContent] - Structured JSON content
 * @param {string} [message.messageId] - Unique message identifier (optional)
 * @param {Object} [message.bubbleStyle] - Custom bubble styling
 * @param {number} [message.progress] - Progress percentage (0-100)
 * @param {Object} [socket=botSocket] - WebSocket instance
 * @returns {Promise<void>}
 */
export async function emitCosmicMessage(msgData, socket = botSocket) {
  try {
    const { frontendId, target = 'bot_frontend', messageId, text, options, taskId, progress, jsonContent } = msgData;
    const effectiveMessageId = messageId || `${taskId || Date.now()}-${target}-${text.slice(0, 50)}`;
    const messageKey = `message:${effectiveMessageId}`;
    const isSent = await get(messageKey);

    if (!frontendId) {
      await error(`⚠️ No frontendId for message "${text}"—cosmic routing misaligned! Targeting ${target} instead`, { taskId });
    }

    if (!socket.connected) {
      await error(`⚠️ WebSocket disconnected—cannot emit "${text}" to ${target} (frontendId: ${frontendId || 'none'})`, { taskId });
      throw new Error('WebSocket not connected');
    }

    if (!isSent) {
      const taskState = await get(`taskState:${frontendId}`);
      await log(`🌌 TaskState for ${frontendId}: ${taskState || 'none'}`, { taskId });
      const message = {
        ...msgData,
        frontendId,
        messageId: effectiveMessageId,
        jsonContent: jsonContent || (msgData.type === 'taskResult' ? { files: {} } : undefined), // Ensure jsonContent for taskResult
      };
      await socket.emit('message', message);
      await set(messageKey, JSON.stringify({ sent: true, timestamp: Date.now() }), 86400); // 24-hour TTL
      await log(`✨ Message ${effectiveMessageId} supernova-beamed to ${target} for frontendId ${frontendId || 'none'}: "${text}" with options: ${JSON.stringify(options || [])} ${progress !== undefined ? `progress: ${progress}%` : ''} ${jsonContent ? 'with JSON content' : ''}`, { taskId });
    } else {
      await log(`✨ Message ${effectiveMessageId} already supernova-beamed to ${target}—cosmic deduplication prevails!`, { taskId });
    }
  } catch (err) {
    await error(`⚠️ Cosmic emission failed for "${msgData.text}": ${err.message} - target: ${msgData.target}, frontendId: ${msgData.frontendId || 'none'}`, { taskId: msgData.taskId });
    throw err;
  }
}

/**
 * Delegates a task to a target bot with queuing, retries, and cosmic flair.
 * @async
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
  const { frontendId, userName, task } = args;
  const requestId = uuidv4();

  const taskData = {
    type: 'message',
    commandFlag: true,
    target: botName,
    command,
    args: {
      task: {
        ...task,
        flair: true,
        aiInstructions: task.aiInstructions || `Forge "${task.name}" for ${userName} with "${task.features}"—infuse cosmic animations, stellar comments, and galactic optimizations!`,
      },
      userName,
      tone: args.tone || DEFAULT_TONE,
      frontendId,
      requestId,
      leadId: socket.id,
    },
  };

  // Register task in Redis
  const taskObj = {
    taskId: task.id,
    frontendId,
    user: userName,
    name: task.name,
    type: task.type,
    features: task.features,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    progress: 0,
  };
  await hSet('tasks', task.id, JSON.stringify(taskObj));
  await log(`🌌 Task ${task.id} supernova-registered in cosmic ledger for ${userName}`, { taskId: task.id });

  // Send building message to frontend
  await emitCosmicMessage({
    text: `🌠 "${task.name}" build initiated, ${userName}! Cosmic gears grinding...`,
    type: 'building',
    taskId: task.id,
    ip: 'unknown',
    user: userName,
    frontendId,
    taskName: task.name,
    taskType: task.type,
    taskFeatures: task.features,
    bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#fff' },
    messageId: `${task.id}-building`,
  }, socket);

  if (!socket.connected) {
    await error(`⚠️ WebSocket signal lost—queuing task ${task.id} for ${botName}`, { taskId: task.id });
    pendingTasksQueue.set(requestId, taskData);
    await hSet('pendingTasksQueue', requestId, JSON.stringify(taskData));
    return new Promise((resolve, reject) => {
      pendingTaskResults.set(requestId, { resolve, reject, taskData });
    });
  }

  await log(`Attempting to delegate task ${task.id} to ${botName}`, { taskId: task.id });
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    let callbackReceived = false;

    const emitCommand = async () => {
      attempts++;
      await log(`🌠 Attempt ${attempts}/${maxAttempts} to beam command to ${botName}, socket.connected: ${socket.connected}`, { taskId: task.id });

      socket.emit('message', taskData, async (ack) => {
        callbackReceived = true;
        if (ack && ack.status === 'success') {
          await log(`Command acknowledged by ${botName}: ${JSON.stringify(ack)}`, { taskId: task.id });
        } else {
          const errMsg = ack?.message || 'No response';
          await error(`⚠️ Command acknowledgment failed: ${JSON.stringify(ack)}`, { taskId: task.id });
          if (attempts >= maxAttempts) {
            pendingTasksQueue.set(requestId, taskData);
            await hSet('pendingTasksQueue', requestId, JSON.stringify(taskData));
            reject(new Error(`Command failed after ${maxAttempts} attempts: ${errMsg}`));
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
        processedMessages.add(messageId);
        socket.off('taskResult', taskResultHandler);
        await processTaskResult(data, args, socket, resolve, reject);
      }
    };

    socket.off('taskResult');
    socket.on('taskResult', taskResultHandler);

    setTimeout(async () => {
      if (!callbackReceived) {
        socket.off('taskResult', taskResultHandler);
        await error(`⚠️ Task delegation timeout after 30s for ${command} to ${botName} with requestId ${requestId}`, { taskId: task.id });
        pendingTasksQueue.set(requestId, taskData);
        await hSet('pendingTasksQueue', requestId, JSON.stringify(taskData));
        await emitCosmicMessage({
          text: `🌠 "${task.name}" signal lost, ${userName}! Cosmic relay timed out—retry?`,
          type: 'error',
          taskId: task.id,
          ip: 'unknown',
          user: userName,
          frontendId,
          options: ['Retry'],
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${task.id}-timeout`,
        }, socket);
        reject(new Error(`Task delegation timeout after 30s`));
      }
    }, 30000);
  });
}

/**
 * Processes task result from bot_backend and caches it with cosmic flair.
 * @async
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
      content = null, // Array of { fileName, content }
      finalContent = null, // Primary base64 content
      fileName = null,
      type = 'html',
      name = 'unknown',
      frontendId = args.frontendId,
      ip = 'unknown',
      taskFeatures = 'unknown',
      version = 1,
      jsonContent = null,
      downloadLink = null,
      error: taskError = null,
      requestId,
    } = data || {};
    const userName = args.userName || 'Guest';
    const tone = args.tone || DEFAULT_TONE;

    await log(`🌟 Decoding taskResult for ${taskId || 'unknown'}—content: ${content ? 'stellar payload acquired!' : 'no payload detected'}`, { taskId });

    if (taskError || !taskId || (!content && !finalContent) || !jsonContent) {
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
        options: ['Retry', 'Adjust Features'],
        finalContent: finalContent || (content && content[0]?.content) || null,
        fileName: fileName || `${name}_error.zip`,
        downloadLink: downloadLink || (content ? `data:application/zip;base64,${content[0]?.content}` : null),
        jsonContent: jsonContent || { files: { 'error.txt': { content: errorMsg, encoding: 'utf8' } } },
        messageId: `${requestId}-${taskId}-error`,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      }, socket);
      await error(`⚠️ Task failed for frontendId ${frontendId} with requestId ${requestId}: ${taskError || 'Missing task data'}`, { taskId });
      reject(new Error(taskError || 'Invalid task data'));
      return;
    }

    await emitCosmicMessage({
      text: `🌌 "${name}" completed, ${userName}! Cosmic masterpiece at 100%...`,
      type: 'progressUpdate',
      taskId,
      progress: 100,
      ip,
      user: userName,
      frontendId,
      taskName: name,
      taskType: type,
      taskFeatures,
      bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
      messageId: `${taskId}-progress-100`,
    }, socket);

    const projectData = {
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName: fileName || `${name}_v${version}.zip`,
      content: finalContent || (content && content[0].content), // Ensure base64 content
      user: userName,
      features: taskFeatures,
      version,
      jsonContent, // Structured JSON from taskExecution.js
      downloadLink: downloadLink || `data:application/zip;base64,${finalContent || content[0].content}`,
      completedAt: new Date().toISOString(),
    };
    const cachedProject = await cacheCompletedTask(projectData);
    if (!cachedProject) throw new Error('Failed to cache project in cosmic vault');
    await setLastGeneratedTask(projectData);

    const taskResultMsg = await generateResponse(
      `✨ Yo ${userName}! "${name}" (${type} v${version}) has supernova-blasted into reality—snag it, preview it, or chart your next cosmic vector! 🌌`,
      userName,
      tone
    );
    await emitCosmicMessage({
      text: taskResultMsg,
      type: 'taskResult',
      taskId,
      finalContent: finalContent || content[0].content,
      fileName: projectData.fileName,
      downloadLink: projectData.downloadLink,
      ip,
      user: userName,
      frontendId,
      taskName: name,
      taskType: type,
      taskFeatures,
      jsonContent, // Forward structured JSON
      options: ['Restart', 'Refine Project', 'Done'],
      messageId: `${requestId}-${taskId}-result`,
      bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
    }, socket);

    await log(`🚀 Task ${taskId} unleashed for ${userName}: ${name}—cosmic payload supernova-delivered!`, { taskId });

    const taskData = await hGet('tasks', taskId);
    if (taskData) {
      const taskObj = JSON.parse(taskData);
      taskObj.step = 'review';
      taskObj.status = 'completed';
      await hSet('tasks', taskId, JSON.stringify(taskObj));
      await updateTaskStatus(taskId, 'completed');
      await hDel('pendingTasks', taskId);

      // Update taskState in Redis
      const stateKey = `taskState:${frontendId}`;
      const taskState = JSON.parse(await get(stateKey)) || {};
      taskState.step = 'review';
      taskState.finalContent = finalContent || content[0].content;
      taskState.fileName = projectData.fileName;
      taskState.downloadLink = projectData.downloadLink;
      await set(stateKey, JSON.stringify(taskState));
    }

    resolve(data);

    const responseHandler = async (msg) => {
      if (msg.type === 'task_response' && msg.taskId === taskId) {
        const choiceLower = msg.text.toLowerCase();
        if (choiceLower === 'done') {
          await updateTaskStatus(taskId, 'completed');
          await hDel('pendingTasks', taskId);
          const stateKey = `taskState:${frontendId}`;
          await set(stateKey, JSON.stringify({ step: 'choice', taskId: `initial:${frontendId}` }));
          const successMsg = await generateResponse(
            `🌟 ${userName}, "${name}" is locked in the galactic archives! Fetch it with /projects or ignite a new supernova! 🚀`,
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
      }
    };

    socket.off('message', responseHandler);
    socket.on('message', responseHandler);
  } catch (err) {
    await error(`⚠️ TaskResult for requestId ${data?.requestId} crashed: ${err.message}`, { taskId: data?.taskId, stack: err.stack });
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
      options: ['Retry', 'Adjust Features'],
      finalContent: data?.finalContent || (data?.content && data.content[0]?.content) || null,
      fileName: data?.fileName || `${data?.name || 'unknown'}_error.zip`,
      downloadLink: data?.downloadLink || (data?.content ? `data:application/zip;base64,${data.content[0]?.content}` : null),
      jsonContent: data?.jsonContent || { files: { 'error.txt': { content: errorMsg, encoding: 'utf8' } } },
      messageId: `${data?.requestId}-${data?.taskId || 'unknown'}-error`,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    }, socket);
    reject(err);
  }
}

/**
 * Initializes WebSocket listeners for state management with cosmic precision.
 * @returns {void}
 */
export function initializeStateManager() {
  botSocket.on('connect', async () => {
    await log('🌌 StateManager online—cosmic channels supernova-charged!');
    // Process queued tasks on reconnect
    const queuedTasks = await hGet('pendingTasksQueue');
    if (queuedTasks) {
      for (const [requestId, taskDataStr] of Object.entries(queuedTasks)) {
        const taskData = JSON.parse(taskDataStr);
        pendingTasksQueue.set(requestId, taskData);
        if (botSocket.connected) {
          await delegateTask(botSocket, taskData.target, taskData.command, taskData.args);
          await hDel('pendingTasksQueue', requestId);
          pendingTasksQueue.delete(requestId);
        }
      }
    }
    for (const [requestId, { taskData, resolve, reject }] of pendingTaskResults) {
      if (botSocket.connected) {
        await delegateTask(botSocket, taskData.target, taskData.command, taskData.args);
        pendingTaskResults.delete(requestId);
      }
    }
  });

  botSocket.on('disconnect', async () => await error('⚠️ StateManager offline—cosmic signal lost in the void!'));

  botSocket.on('taskResult', async (data) => {
    await log(`🌟 TaskResult supernova-received from bot_backend: ${JSON.stringify(data)}`, { taskId: data.taskId });
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
      await error(`⚠️ Task ${data.taskId} not found in cosmic ledger—lost in hyperspace!`, { taskId: data.taskId });
    }
  });

  botSocket.on('message', async (data) => {
    const messageId = `${data?.requestId || data?.taskId || Date.now()}-${data?.type || 'unknown'}-${data?.text?.slice(0, 50) || 'no-text'}`;
    if (processedMessages.has(messageId)) {
      await log(`✨ Message ${messageId} already supernova-processed—cosmic efficiency reigns!`, { taskId: data?.taskId });
      return;
    }

    processedMessages.add(messageId);

    if (data.type === 'progressUpdate' && data.taskId) {
      await set(`progress:${data.taskId}`, data.progress || 0, 86400); // 24-hour TTL
      await emitCosmicMessage({
        ...data,
        messageId,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
      }, botSocket);

      // Update task progress in Redis
      const taskData = await hGet('tasks', data.taskId);
      if (taskData) {
        const taskObj = JSON.parse(taskData);
        taskObj.progress = data.progress;
        await hSet('tasks', data.taskId, JSON.stringify(taskObj));
      }
    }

    if (data.type === 'pending' && data.taskId) {
      const { taskId, user, frontendId, ip, taskName } = data;
      const pendingTaskData = {
        taskId,
        frontendId,
        ip,
        name: taskName,
        user,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await hSet('pendingTasks', taskId, JSON.stringify(pendingTaskData));
      await emitCosmicMessage({
        ...data,
        messageId,
        bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#fff' },
      }, botSocket);
      await log(`🌌 Task ${taskId} supernova-queued for ${user}—cosmic ledger updated!`, { taskId });
    }

    if (data.commandFlag && data.text === 'store_project' && data.taskId) {
      const { taskId, user, frontendId, ip, taskName, taskType, taskFeatures, finalContent, jsonContent } = data;
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
        jsonContent: jsonContent || { files: { 'readme.txt': { content: 'Manual store_project', encoding: 'utf8' } } },
        downloadLink: `data:application/zip;base64,${finalContent}`,
        completedAt: new Date().toISOString(),
      };
      const cachedProject = await cacheCompletedTask(projectData);
      if (!cachedProject) throw new Error('Failed to cache project');
      await updateTaskStatus(taskId, 'completed');
      await hDel('pendingTasks', taskId);
      await set(`taskState:${frontendId}`, JSON.stringify({ step: 'choice', taskId: `initial:${frontendId}` }));
      const successMsg = await generateResponse(
        `🌟 "${taskName}" supernova-sealed in the cosmic vault, ${user}! Warp to /projects or spark a new galactic flame! 🚀`,
        user,
        tone
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
      await log(`🌟 Project ${taskId} supernova-cached for ${user}—ready for cosmic retrieval!`, { taskId });
    }

    if (data.commandFlag && data.text.toLowerCase().includes('enhance this') && data.taskId && data.fileName) {
      const { taskId, user, frontendId, ip, fileName } = data;
      const suggestion = await generateResponse(
        `✨ Supernova-charging "${fileName}" for ${user}: ${data.text}—infusing cosmic flair and stellar upgrades! 🌌`,
        user,
        tone
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
    await log('🌌 stateManager.js v2025-04-11-05 supernova-ignited with interstellar precision!');
    const stored = await getLastGeneratedTask();
    if (stored) {
      await log(`🌟 Loaded last task ${stored.taskId} from cosmic vault—sync supernova-restored!`, { taskId: stored.taskId });
    }
    initializeStateManager();
  } catch (err) {
    await error(`⚠️ StateManager ignition failed: ${err.message}`);
  }
})();

export { lastGeneratedTask };