// bot_backend/src/taskExecution.js
// Version: v2025-07-28-06
/**
 * Task Execution for CrackerBot Backend
 * Executes tasks and manages progress updates with cosmic precision.
 * Enhanced by xAI for robust task handling, progress tracking, error management, and stale task skipping.
 *
 * @version 2025-07-28-06
 * @author CrackerBot Team, enhanced by xAI
 * @module taskExecution
 */

import { log, error } from './logger.js';
import { generateFiles, generateZip } from './fileGenerator.js';
import { botSocketPromise } from './socket.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';
import { redisClient, set, get, hGet, hSet, hDel } from './redisClient.js';

const TECH_STACKS = ['full stack', 'mean', 'mern', 'lamp', 'jamstack'];
const MULTIMEDIA_TYPES = ['image', 'jpeg', 'gif', 'mp4'];

/**
 * Mapping of project types to file extensions for cosmic outputs.
 * @type {Object<string, string>}
 */
export const extensionMap = {
  javascript: 'js',
  js: 'js',
  python: 'py',
  php: 'php',
  ruby: 'rb',
  java: 'java',
  'c++': 'cpp',
  typescript: 'ts',
  go: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  csharp: 'cs',
  r: 'r',
  scala: 'scala',
  dart: 'dart',
  perl: 'pl',
  lua: 'lua',
  bash: 'sh',
  powershell: 'ps1',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
  markdown: 'md',
  toml: 'toml',
  graph: 'zip',
  react: 'jsx',
  vue: 'vue',
  angular: 'ts',
  docker: 'Dockerfile',
  doc: 'txt',
  csv: 'csv',
  json: 'json',
  pdf: 'pdf',
  exe: 'exe',
  bat: 'bat',
  html: 'html',
  image: 'png',
  jpeg: 'jpeg',
  gif: 'gif',
  mp4: 'mp4',
};

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
 * Validates task data to prevent undefined property errors.
 * @param {Object} task - Task data
 * @returns {boolean} True if valid
 */
function validateTask(task) {
  return (
    task &&
    typeof task.taskId === 'string' &&
    typeof task.frontendId === 'string' &&
    typeof task.user === 'string' &&
    /^[a-zA-Z0-9_-]{1,20}$/.test(task.user) &&
    typeof task.taskName === 'string' &&
    typeof task.taskType === 'string'
  );
}

/**
 * Checks if a task is stale based on creation time.
 * @async
 * @param {string} taskId - Task ID
 * @returns {boolean} True if stale
 */
async function isTaskStale(taskId) {
  const taskData = await hGet('tasks', taskId);
  if (!taskData || !isValidJSON(taskData)) return true;

  const task = JSON.parse(taskData);
  const createdAt = new Date(task.createdAt).getTime();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  return task.status === 'in_progress' && (now - createdAt) > maxAge;
}

/**
 * Sends progress update to frontend with retry logic and cosmic logging.
 * @async
 * @param {Object} socket - Socket.IO client instance
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} taskName - Project name
 * @param {string} taskType - Project type
 * @param {string} taskFeatures - Task features
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<void>}
 */
export async function sendProgress(socket, taskId, percentage, message, frontendId, ip, taskName, taskType, taskFeatures, requestId, leadId) {
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `🌌 CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    taskName,
    taskType,
    taskFeatures,
    requestId,
    leadId: leadId || socket.id || 'unknown',
    messageId: `${taskId}-progress-${percentage}-${Date.now()}`,
    bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
    timestamp: new Date().toISOString(),
  };

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (!socket.connected) throw new Error('WebSocket not connected');
      await log(`Sending progress ${percentage}% for ${taskId}: ${message}, attempt ${attempt + 1}`, { taskId, taskName, taskType, progress: percentage });
      socket.emit('message', progressMessage);
      await log(`Progress ${percentage}% beamed for ${taskId}: ${message}`, { taskId, taskName, taskType, frontendId, progress: percentage });
      await set(`progress:${taskId}`, percentage.toString());
      break;
    } catch (err) {
      attempt++;
      await error(`Progress send failed for ${taskId} at ${percentage}%: ${err.message}, attempt ${attempt}`, { taskId, taskName, taskType, progress: percentage });
      if (attempt === maxRetries) throw new Error(`Progress send failed after ${maxRetries} attempts: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Executes a task with cosmic precision, generating files and updating progress.
 * @async
 * @param {Object} socket - WebSocket instance
 * @param {Object} task - Task data
 * @param {string} task.taskId - Task ID
 * @param {string} task.taskName - Task name
 * @param {string} task.taskType - Task type
 * @param {string} task.taskFeatures - Task features
 * @param {string} task.frontendId - Frontend ID
 * @param {string} task.ip - Client IP
 * @param {string} task.user - User name
 * @param {string} task.sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function executeTask(socket, { taskId, taskName, taskType, taskFeatures, frontendId, ip, user, sessionId }) {
  if (!validateTask({ taskId, taskName, taskType, frontendId, user })) {
    await error(`Invalid task data: ${JSON.stringify({ taskId, taskName, taskType, frontendId, user })}`, { taskId, frontendId });
    await socket.emit('message', {
      text: `Cosmic static detected! Invalid task data. Please retry.`,
      type: 'error',
      taskId: taskId || 'unknown',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip: ip || 'unknown',
      user: user || 'Guest',
      frontendId: frontendId || 'unknown',
      messageId: `error-${Date.now()}`,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (await isTaskStale(taskId)) {
    await log(`Skipping stale task ${taskId} for ${user} (ID: ${frontendId})`, { taskId });
    await socket.emit('message', {
      text: `Previous build for "${taskName}" expired. Start a new cosmic creation?`,
      type: 'error',
      taskId,
      ip,
      user,
      frontendId,
      options: ['Chat', 'Build-Something-Epic'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `stale-task-${Date.now()}`,
    });
    await hDel('tasks', taskId);
    await del(`progress:${taskId}`);
    return;
  }

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await log(`🌌 Igniting task ${taskId} for ${user} (ID: ${frontendId})—Type: ${taskType}, Name: ${taskName}, Features: ${taskFeatures}`, { taskId });

      await sendProgress(socket, taskId, 0, `Igniting cosmic forge for ${taskName}...`, frontendId, ip, taskName, taskType, taskFeatures, taskId, socket.id);

      await socket.emit('message', {
        text: `🌌 Forging ${taskName} in the cosmic forge...`,
        type: 'building',
        taskId,
        ip,
        user,
        frontendId,
        sessionId,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
        messageId: `${taskId}-building`,
      });

      const enhancedFeatures = await generateResponse(
        `Enhance these features with extra cosmic flair, robustness, high quality, lots of detail, optimized structures, rich comments, animations, and creative additions: ${taskFeatures}. Make it super detailed and comprehensive.`,
        user,
        DEFAULT_TONE,
        { taskId }
      );

      await sendProgress(socket, taskId, 20, `AI flair infused—features amplified with stellar detail!`, frontendId, ip, taskName, taskType, enhancedFeatures, taskId, socket.id);

      const files = await generateFiles({ taskName, taskType, taskFeatures: enhancedFeatures });
      await sendProgress(socket, taskId, 50, `Files forged with interstellar precision!`, frontendId, ip, taskName, taskType, enhancedFeatures, taskId, socket.id);

      const zipContent = await generateZip(files);
      const downloadLink = `data:application/zip;base64,${zipContent}`;
      await sendProgress(socket, taskId, 90, `Cosmic archive sealed—ready for warp download!`, frontendId, ip, taskName, taskType, enhancedFeatures, taskId, socket.id);

      const projectData = {
        taskId,
        frontendId,
        ip,
        name: taskName,
        type: taskType,
        fileName: `${taskName}.zip`,
        content: zipContent,
        user,
        features: enhancedFeatures,
        version: 1,
        jsonContent: files,
        downloadLink,
        completedAt: new Date().toISOString(),
      };
      await set(`project:${user}:${taskId}`, JSON.stringify(projectData));

      await socket.emit('message', {
        text: `✨ ${taskName} forged with cosmic brilliance! Ready to download or refine!`,
        type: 'taskResult',
        taskId,
        ip,
        user,
        frontendId,
        sessionId,
        taskName,
        taskType,
        taskFeatures: enhancedFeatures,
        finalContent: zipContent,
        downloadLink,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
        messageId: `${taskId}-result`,
      });

      await sendProgress(socket, taskId, 100, `Project complete—stellar masterpiece ready!`, frontendId, ip, taskName, taskType, enhancedFeatures, taskId, socket.id);

      await hSet('tasks', taskId, JSON.stringify({
        taskId,
        taskName,
        taskType,
        taskFeatures,
        status: 'completed',
        frontendId,
        user,
        content: zipContent,
        fileName: `${taskName}.zip`,
      }));
      await del(`progress:${taskId}`);

      await log(`Task ${taskId} completed and cached for ${user} (ID: ${frontendId})`, { taskId });
      return;
    } catch (err) {
      attempt++;
      await error(`Task ${taskId} failed for ${user} (ID: ${frontendId}), attempt ${attempt}/${maxRetries}: ${err.message}`, { taskId });
      if (attempt === maxRetries) {
        const errorMsg = await generateResponse(
          `🌌 Cosmic anomaly! Task ${taskName} failed: ${err.message}. Max attempts reached.`,
          user,
          DEFAULT_TONE,
          { taskId }
        );
        await socket.emit('message', {
          text: errorMsg,
          type: 'error',
          taskId,
          ip,
          user,
          frontendId,
          sessionId,
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          messageId: `${taskId}-error`,
        });
        await hSet('tasks', taskId, JSON.stringify({
          taskId,
          taskName,
          taskType,
          taskFeatures,
          status: 'failed',
          frontendId,
          user,
        }));
        await del(`progress:${taskId}`);
        throw new Error(`Task ${taskId} failed after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/**
 * Initializes task execution listeners.
 * @async
 */
export async function initializeTaskListeners() {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const socket = await botSocketPromise;
      if (!socket) {
        throw new Error('WebSocket not initialized');
      }

      await log('🌌 taskExecution.js v2025-07-28-06: AI-driven builds with SUPERNOVA cosmic flair!', { taskId: 'init' });

      socket.on('message', async (data) => {
        try {
          const { type, taskId, taskName, taskType, taskFeatures, frontendId, ip, user, sessionId } = data;
          await log(`Received message: ${JSON.stringify({ type, taskId, taskName, taskType, taskFeatures, frontendId, ip, user, sessionId })}`, { taskId });
          if (type === 'task_execution') {
            if (await isTaskStale(taskId)) {
              await log(`Skipping stale task execution for ${taskId}`, { taskId });
              await socket.emit('message', {
                text: `Previous build for "${taskName}" expired. Start a new cosmic creation?`,
                type: 'error',
                taskId,
                ip,
                user,
                frontendId,
                options: ['Chat', 'Build-Something-Epic'],
                bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
                messageId: `stale-task-${Date.now()}`,
              });
              await hDel('tasks', taskId);
              await del(`progress:${taskId}`);
              return;
            }
            await executeTask(socket, { taskId, taskName, taskType, taskFeatures, frontendId, ip, user, sessionId });
          }
        } catch (err) {
          await error(`Failed to handle message: ${err.message}`, { taskId: data.taskId });
        }
      });

      socket.on('connect', async () => {
        await log('🌌 bot_backend WebSocket connected—cosmic channels live!');
      });

      socket.on('connect_error', async (err) => {
        await error(`bot_backend WebSocket connect error: ${err.message}`);
      });

      socket.on('disconnect', async () => {
        await error('bot_backend WebSocket disconnected');
      });

      socket.on('heartbeat', async () => {
        await log(`bot_backend WebSocket heartbeat: radiating cosmic energy!`);
      });

      await log('🌌 taskExecution.js fully ignited—cosmic engines roaring!', { taskId: 'init' });
      return;
    } catch (err) {
      attempt++;
      await error(`Failed to initialize taskExecution, attempt ${attempt}/${maxRetries}: ${err.message}`, { taskId: 'init' });
      if (attempt === maxRetries) {
        throw new Error(`Failed to initialize taskExecution after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

(async () => {
  try {
    await log('Starting taskExecution.js initialization', { taskId: 'init' });
    await initializeTaskListeners();
    await log('Task execution v2025-07-28-06 initialized with galactic precision', { taskId: 'init' });
  } catch (err) {
    await error(`taskExecution.js supernova-failed: ${err.message}`, { taskId: 'init' });
    process.exit(1);
  }
})(); 