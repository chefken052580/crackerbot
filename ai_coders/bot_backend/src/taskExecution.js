// bot_backend/src/taskExecution.js
// Version: v2025-04-10-12
/* CrackerBot’s cosmic task engine—forging interstellar masterpieces with supernova swagger! 🌌 */

import { openai } from './aiHelper.js';
import { botSocket as botSocketPromise, emit } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error, debug } from './logger.js';
import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { exec } from 'child_process';
import util from 'util';
import { buildTask, editTask as editTaskBuilder } from './taskBuilder.js';

const execPromise = util.promisify(exec);

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
 * Initializes WebSocket listeners for task execution with cosmic precision and robust retry logic.
 * @async
 * @param {Object} botSocket - The connected Socket.IO client instance
 * @returns {Promise<void>}
 */
async function initializeTaskExecution(botSocket) {
  console.log(`[${new Date().toISOString()}] Backend bot connected to WebSocket server`);
  await log('taskExecution.js v2025-04-10-12: AI-driven builds with SUPERNOVA cosmic flair!');
  await debug('Initializing WebSocket listeners', { taskId: 'init' });

  botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  await log('bot_backend registered—ready to ignite the cosmos!');

  botSocket.on('connect', async () => {
    await log('🌌 bot_backend WebSocket connected—cosmic channels live!');
  });

  botSocket.on('connect_error', async (err) => {
    await error(`bot_backend WebSocket connect error: ${err.message}`);
  });

  botSocket.on('message', async (data, ack) => {
    await log(`📩 Received message: ${JSON.stringify(data)}`, { taskId: data.args?.task?.id || 'unknown' });
    await debug('Processing incoming message', { taskId: data.args?.task?.id || 'unknown' });

    if (!data.commandFlag || data.command !== 'buildTask' || data.target !== 'bot_backend') {
      await debug(`Ignoring non-buildTask message: ${data.command || 'no command'}`, { taskId: data.args?.task?.id });
      if (ack) ack({ status: 'ignored', message: 'Not a buildTask command' });
      return;
    }

    const { task, userName, tone, frontendId, requestId, leadId } = data.args || {};
    if (!task || !task.id || !task.type || !frontendId || !requestId || !leadId) {
      await error(`Invalid task data: ${JSON.stringify(data)}`, { taskId: task?.id });
      const fallbackContent = `CrackerBot hit a cosmic snag! Invalid task data: ${JSON.stringify(data)}. Retry or tweak it! 🌠`;
      const files = { 'error.txt': Buffer.from(fallbackContent) };
      const zipBuffer = await zipFilesWithReadme(files, task || { name: 'unknown', userName: 'Guest' });
      const jsonContent = {
        taskId: task?.id || 'unknown',
        name: task?.name || 'unknown',
        type: task?.type || 'unknown',
        features: task?.features || 'none',
        userName: userName || 'Guest',
        files: { 'error.txt': { content: fallbackContent, encoding: 'utf8' } },
      };
      await emitTaskResult(botSocket, {
        taskId: task?.id || 'unknown',
        error: 'Invalid task data: missing required fields',
        jsonContent,
        content: [{ fileName: 'error.zip', content: zipBuffer.toString('base64') }],
        requestId,
        leadId,
        frontendId,
      });
      if (ack) ack({ status: 'error', message: 'Invalid task data' });
      return;
    }

    await log(`🌌 Build command received for task ${task.id}`, { taskId: task.id, taskName: task.name, taskType: task.type });
    if (ack) ack({ status: 'success', message: 'Task received' });

    try {
      await log(`🌌 Processing buildTask for ${task.id}: ${task.features}`, { taskId: task.id, taskName: task.name, taskType: task.type });
      const result = await startBuildTask(botSocket, task, userName, tone, frontendId, requestId, leadId);

      let finalContentBase64, finalFileName, jsonContent;
      if (result.content && result.jsonContent) {
        const contentArray = Array.isArray(result.content) ? result.content : [result.content];
        finalContentBase64 = contentArray.map(item => ({
          fileName: item.fileName,
          content: item.content,
        }));
        finalFileName = contentArray[0].fileName.endsWith('.zip') ? contentArray[0].fileName : `${task.name}${task.version ? `-v${task.version}` : ''}.zip`;
        jsonContent = result.jsonContent;
      } else {
        const fallbackContent = `CrackerBot generated minimal content for ${task.name}, ${userName}! Features: ${task.features}. Try tweaking for more! 🌠`;
        const files = { 'readme.txt': Buffer.from(fallbackContent) };
        const zipBuffer = await zipFilesWithReadme(files, task);
        finalContentBase64 = [{ fileName: `${task.name}_fallback.zip`, content: zipBuffer.toString('base64') }];
        finalFileName = `${task.name}_fallback.zip`;
        jsonContent = {
          taskId: task.id,
          name: task.name,
          type: task.type,
          features: task.features,
          userName,
          files: { 'readme.txt': { content: fallbackContent, encoding: 'utf8' } },
        };
        await log(`Fallback ZIP generated for ${task.id}`, { taskId: task.id });
      }

      const taskResult = {
        taskId: task.id,
        content: finalContentBase64,
        fileName: finalFileName,
        type: task.type,
        name: task.name,
        frontendId,
        ip: task.ip || 'unknown',
        taskFeatures: task.features,
        version: task.version || 1,
        jsonContent,
        downloadLink: `/download/${task.id}`,
        error: result.error,
        requestId,
        leadId,
      };

      await emitTaskResult(botSocket, taskResult);
      await log(`🌠 Task ${task.id} completed and beamed to ${frontendId}`, {
        taskId: task.id,
        fileCount: finalContentBase64.length,
        contentSize: finalContentBase64.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'base64'), 0),
      });
    } catch (err) {
      await error(`Build failed for ${task.id}: ${err.message}`, { taskId: task.id, stack: err.stack });
      const fallbackContent = `CrackerBot hit a cosmic snag, ${userName}! Error: ${err.message}. Retry or tweak it! 🌠`;
      const files = { 'error.txt': Buffer.from(fallbackContent) };
      const zipBuffer = await zipFilesWithReadme(files, task);
      const jsonContent = {
        taskId: task.id,
        name: task.name,
        type: task.type,
        features: task.features,
        userName,
        files: { 'error.txt': { content: fallbackContent, encoding: 'utf8' } },
      };
      const taskResult = {
        taskId: task.id,
        content: [{ fileName: `${task.name}_error.zip`, content: zipBuffer.toString('base64') }],
        fileName: `${task.name}_error.zip`,
        type: task.type,
        name: task.name,
        frontendId,
        ip: task.ip || 'unknown',
        taskFeatures: task.features,
        version: task.version || 1,
        jsonContent,
        error: `Task processing failed: ${err.message}`,
        requestId,
        leadId,
      };
      await emitTaskResult(botSocket, taskResult);
      await log(`Error fallback ZIP sent for ${task.id}`, { taskId: task.id });
    }
  });

  botSocket.on('command', async (data) => {
    const { command, args } = data;
    await log(`Received command: ${command}`, { taskId: args?.taskId });
    if (command === 'cleanupTask') {
      await cleanupTempFiles(args.taskId, args.userName);
    }
  });

  botSocket.on('disconnect', async () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected`);
    await error('bot_backend WebSocket disconnected');
  });

  console.log(`[${new Date().toISOString()}] Task execution v2025-04-10-12 initialized with galactic precision`);
}

/**
 * Emits task result to WebSocket with retry logic and detailed cosmic logging.
 * @async
 * @param {Object} botSocket - The connected Socket.IO client instance
 * @param {Object} taskResult - Result data with jsonContent
 * @returns {Promise<void>}
 */
async function emitTaskResult(botSocket, taskResult) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (!botSocket.connected) throw new Error('WebSocket not connected');
      await debug(`Emitting taskResult for ${taskResult.taskId}, attempt ${attempt + 1}`, { taskId: taskResult.taskId, files: taskResult.jsonContent.files });
      await emit('taskResult', taskResult, (ack) => {
        if (ack?.status !== 'success') {
          throw new Error(`Task result ack failed: ${JSON.stringify(ack)}`);
        }
      });
      await log(`Task result emitted successfully for ${taskResult.taskId}`, {
        taskId: taskResult.taskId,
        fileCount: Object.keys(taskResult.jsonContent.files).length,
      });
      return;
    } catch (err) {
      attempt++;
      await error(`Failed to emit taskResult for ${taskResult.taskId}, attempt ${attempt}: ${err.message}`, { taskId: taskResult.taskId });
      if (attempt === maxRetries) throw new Error(`Task result emission failed after ${maxRetries} attempts: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Sends progress update to frontend with retry logic and detailed logging.
 * @async
 * @param {Object} botSocket - The connected Socket.IO client instance
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} name - Project name
 * @param {string} type - Project type
 * @param {string} features - Task features
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<void>}
 */
async function sendProgress(botSocket, taskId, percentage, message, frontendId, ip, name, type, features, requestId, leadId) {
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `🌌 CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    taskName: name,
    taskType: type,
    taskFeatures: features,
    requestId,
    leadId,
    messageId: `${taskId}-progress-${percentage}-${Date.now()}`,
    bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
  };

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (!botSocket.connected) throw new Error('WebSocket not connected');
      await debug(`Sending progress ${percentage}% for ${taskId}: ${message}, attempt ${attempt + 1}`, { taskId, taskName: name, taskType: type, progress: percentage });
      await emit('message', progressMessage);
      await log(`Progress ${percentage}% beamed for ${taskId}: ${message}`, { taskId, taskName: name, taskType: type, frontendId, progress: percentage });
      break;
    } catch (err) {
      attempt++;
      await error(`Progress send failed for ${taskId} at ${percentage}%: ${err.message}, attempt ${attempt}`, { taskId, taskName: name, taskType: type, progress: percentage });
      if (attempt === maxRetries) throw new Error(`Progress send failed after ${maxRetries} attempts: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Cleans up temporary files with cosmic precision.
 * @async
 * @param {string} taskId - Task ID
 * @param {string} userName - User name
 * @returns {Promise<void>}
 */
async function cleanupTempFiles(taskId, userName) {
  try {
    const tempDir = '/tmp';
    const files = await fs.readdir(tempDir);
    for (const file of files.filter((f) => f.includes(taskId))) {
      await fs.unlink(`${tempDir}/${file}`);
      await log(`🧹 Cleaned ${file} for ${userName}`, { taskId });
    }
    await log(`🧹 Cleanup complete for ${taskId}`, { taskId });
  } catch (err) {
    await error(`Cleanup failed for ${taskId}: ${err.message}`, { taskId });
  }
}

/**
 * Starts a build task with progress and flair, returning JSON-structured content.
 * @async
 * @param {Object} botSocket - The connected Socket.IO client instance
 * @param {Object} task - Task data
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @param {string} frontendId - Frontend ID
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Build result with jsonContent
 */
export async function startBuildTask(botSocket, task, userName, tone, frontendId, requestId, leadId) {
  const { id: taskId, name, features, type, ip, aiInstructions } = task;
  await log(`🚀 Starting build for ${name} (${type}) with features: "${features}" for ${userName}`, { taskId, taskName: name, taskType: type });
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await debug('Starting build task', { taskId, taskName: name, taskType: type, features });
    await sendProgress(botSocket, taskId, 0, 'Task ignited—CrackerBot’s on it! 🔥', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(botSocket, taskId, 10, 'Engines firing—building your cosmic creation... ⚡️', frontendId, ip, name, type, features, requestId, leadId);

    await sendProgress(botSocket, taskId, 20, 'Assembling stellar blueprints...', frontendId, ip, name, type, features, requestId, leadId);
    const result = await Promise.race([
      buildTask(task, userName, tone, requestId, leadId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Build timeout')), 60000)),
    ]);
    if (!result || !result.content || !result.jsonContent) throw new Error('Build returned no content');

    await sendProgress(botSocket, taskId, 80, 'Infusing supernova flair—almost there! ✨', frontendId, ip, name, type, features, requestId, leadId);
    const contentArray = Array.isArray(result.content) ? result.content : [result.content];
    const finalContentBase64 = contentArray.map(item => ({
      fileName: item.fileName,
      content: item.content,
    }));
    const finalFileName = contentArray[0].fileName.endsWith('.zip') ? contentArray[0].fileName : `${name}.zip`;

    await sendProgress(botSocket, taskId, 100, `${type} masterpiece primed to shine! 🌟`, frontendId, ip, name, type, features, requestId, leadId);
    return {
      content: finalContentBase64,
      jsonContent: result.jsonContent,
      fileName: finalFileName,
    };
  } catch (err) {
    await error(`startBuildTask failed for ${taskId}: ${err.message}`, { taskId, taskName: name, taskType: type, stack: err.stack });
    await sendProgress(botSocket, taskId, 50, `Cosmic snag: ${err.message}—falling back...`, frontendId, ip, name, type, features, requestId, leadId);
    
    const fallbackContent = `CrackerBot hit a cosmic snag, ${userName}! Error: ${err.message}. Features: ${features}. Retry or tweak it! 🌠`;
    const files = { 'error.txt': Buffer.from(fallbackContent) };
    const zipBuffer = await zipFilesWithReadme(files, task);
    const jsonContent = {
      taskId,
      name,
      type,
      features,
      userName,
      files: { 'error.txt': { content: fallbackContent, encoding: 'utf8' } },
    };
    
    await sendProgress(botSocket, taskId, 100, 'Fallback generated—ready for retry! 🌌', frontendId, ip, name, type, features, requestId, leadId);
    return {
      error: `Failed to build task: ${err.message}`,
      content: [{ fileName: `${name}_error.zip`, content: zipBuffer.toString('base64') }],
      jsonContent,
      fileName: `${name}_error.zip`,
    };
  }
}

/**
 * Starts an edit task with progress and flair, returning JSON-structured content.
 * @async
 * @param {Object} botSocket - The connected Socket.IO client instance
 * @param {Object} task - Task data
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @param {string} frontendId - Frontend ID
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Edit result with jsonContent
 */
export async function startEditTask(botSocket, task, userName, tone, frontendId, requestId, leadId) {
  const { name, features, type, ip, version = 1 } = task;
  await log(`✨ Remixing ${name} (${type}) with features: "${features}"`, { taskId: task.id, taskName: name, taskType: type });
  try {
    await debug('Starting edit task', { taskId: task.id, taskName: name, taskType: type });
    await sendProgress(botSocket, task.id, 0, 'Edit mode activated—CrackerBot’s remixing! 🎛️', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(botSocket, task.id, 10, 'Kicking off the cosmic remix...', frontendId, ip, name, type, features, requestId, leadId);

    await sendProgress(botSocket, task.id, 20, 'Reweaving stellar threads...', frontendId, ip, name, type, features, requestId, leadId);
    const result = await Promise.race([
      editTaskBuilder(task, userName, tone, requestId, leadId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Edit timeout')), 60000)),
    ]);
    if (!result || !result.content) throw new Error('Edit task returned no content');

    await sendProgress(botSocket, task.id, 100, 'Edit locked in—ready to rock! 🎸', frontendId, ip, name, type, features, requestId, leadId);
    await log(`Edit content generated for ${name}, files: ${result.content.length}`, { taskId: task.id });
    return result;
  } catch (err) {
    await error(`startEditTask failed for ${task.id}: ${err.message}`, { taskId: task.id, taskName: name, taskType: type, stack: err.stack });
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

// Async initialization with robust connection wait
(async () => {
  console.log(`[${new Date().toISOString()}] Starting taskExecution.js initialization`);
  await debug('🌌 taskExecution.js v2025-04-10-12 initialization starting...');
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await log(`🌌 taskExecution.js v2025-04-10-12 supernova-igniting—attempt ${attempt + 1}/${maxRetries}...`);
      const botSocket = await botSocketPromise;

      let connectAttempt = 0;
      const maxConnectRetries = 10;
      while (!botSocket.connected && connectAttempt < maxConnectRetries) {
        await debug(`Waiting for WebSocket connection, attempt ${connectAttempt + 1}/${maxConnectRetries}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, connectAttempt)));
        connectAttempt++;
      }
      if (!botSocket.connected) throw new Error('WebSocket failed to connect after retries');

      await initializeTaskExecution(botSocket);
      await log('🌌 taskExecution.js fully ignited—cosmic engines roaring!');
      break;
    } catch (err) {
      attempt++;
      await error(`Failed to initialize taskExecution, attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt === maxRetries) {
        console.error(`[${new Date().toISOString()}] ERROR: Task execution initialization failed after ${maxRetries} attempts: ${err.message}`);
        await error(`Task execution initialization failed after ${maxRetries} attempts: ${err.message}`);
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
})();