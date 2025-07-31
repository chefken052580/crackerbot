// ai_coders/bot_lead/src/messageUtils.js
// Version: v2025-07-20-05
/**
 * Message Utilities Module
 * Processes general messages and initiates build flows with cosmic flair, ensuring alignment with taskHandlers.js.
 * Enhanced by xAI for task state consistency, Redis caching, and supernova robustness.
 *
 * @version 2025-07-20-05
 * @author CrackerBot Team, enhanced by xAI
 * @module messageUtils
 */

import { log } from './logger.js';
import { getCompletedProjects, getLatestProject, get, hSet, set, storeMessage } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';

/**
 * Processes general user messages, initiating build flows or chat responses with task state checks.
 * @async
 * @param {Object} botSocket - WebSocket instance
 * @param {string} text - User input
 * @param {string} userName - User name
 * @param {string} tone - Response tone
 * @param {string} ip - Client IP
 * @param {string} frontendId - Frontend identifier
 * @returns {Promise<void>}
 */
export async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
  if (!text || text.trim() === '') {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you ghosted me with nothing! Drop some words, fam! 🌌`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    });
    await log(`Empty message from ${userName} (frontendId: ${frontendId})`);
    return;
  }

  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });
  const buildIntentKeywords = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];
  const hasBuildIntent = buildIntentKeywords.some(keyword => text.toLowerCase().includes(keyword)) || text.toLowerCase() === 'build something epic!';

  // Check current task state to avoid conflicts
  const stateKey = `taskState:${frontendId}`;
  const taskState = await get(stateKey) || { step: 'choice', taskId: `initial:${frontendId}` };
  if (['project_name', 'type', 'pending_features', 'building', 'network'].includes(taskState.step)) {
    const errorMsg = await generateResponse(
      `🌌 Hold up, ${userName}! You're forging a cosmic masterpiece at step "${taskState.step}". Finish or reset with /reset_name!`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
      taskId: taskState.taskId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
    });
    await log(`Blocked build intent for ${userName} (frontendId: ${frontendId}) due to active task state: ${taskState.step}`);
    return;
  }

  if (hasBuildIntent) {
    const taskId = `${Date.now()}:${frontendId}`;
    await hSet('tasks', taskId, JSON.stringify({
      taskId,
      step: 'project_name',
      user: userName,
      initialInput: text,
      status: 'pending',
      frontendId,
      createdAt: new Date().toISOString(),
    }));
    const namePrompt = await generateResponse(
      `🌟 Yo ${userName}, let's craft something epic! Name your cosmic creation! 🚀`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: namePrompt,
      type: 'question',
      taskId,
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      ip,
      user: userName,
      options: ['Name your project!'],
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
      messageId: `${taskId}-project_name`,
    });
    await set(stateKey, JSON.stringify({ step: 'project_name', taskId }));
    await log(`Started new task ${taskId} for ${userName} with step 'project_name'`);
  } else {
    const taskId = `chat:${Date.now()}`;
    const userInfoKey = `user:frontend:${frontendId}:info`;
    const userInfo = await get(userInfoKey) || {};
    let chatPrompt;
    if (!userInfo.favoriteTech) {
      chatPrompt = await generateResponse(
        `🌌 Yo ${userName}, I’m CrackerBot Prime—master of the cosmic code! What's your favorite tech to vibe with?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: chatPrompt,
        type: 'question',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
      });
    } else {
      chatPrompt = await generateResponse(
        `🌟 Back for more, ${userName}? CrackerBot’s got ${Object.keys(extensionMap).length} cosmic tricks. What's sparking your galaxy today?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: chatPrompt,
        type: 'question',
        taskId,
        from: 'CrackerBot Prime',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #ffcc00)', color: '#000' },
      });
    }
    // Store message with JSON format for consistency
    const messageData = { text, timestamp: new Date().toISOString(), frontendId };
    await storeMessage(userName, messageData);
    await log(`Processed chat message for ${userName} (frontendId: ${frontendId}): ${text}`);
  }
}

/**
 * Fetches a user's completed projects from Redis with cosmic formatting.
 * @async
 * @param {string} user - User name
 * @returns {Promise<string>} Formatted project list or error message
 */
export async function fetchProjects(user) {
  try {
    const taskIds = await getCompletedProjects(user);
    if (taskIds.length === 0) {
      return `🌌 No completed projects yet, ${user}! Let’s forge a cosmic masterpiece—hit "Build-Something-Epic"!`;
    }
    const projects = await Promise.all(taskIds.map(id => getTask(user, id)));
    const validProjects = projects.filter(task => task && task.name && task.type);
    const projectList = validProjects.map((task, index) => {
      return `${index + 1}. ${task.name} (${task.type} v${task.version || 1}) - ${task.timestamp} | Features: ${task.features.slice(0, 50)}${task.features.length > 50 ? '...' : ''}`;
    }).join('\n');
    return `🌟 Your cosmic vault, ${user}:\n${projectList}\nType "/download" for the latest or spark a new creation!`;
  } catch (err) {
    await log(`Fetching projects for ${user} crashed: ${err.message}`);
    return `⚠️ Glitch fetching your cosmic stash, ${user}—retry soon!`;
  }
}

/**
 * Retrieves a task from Redis by user and taskId.
 * @async
 * @param {string} user - User name
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task data or fallback
 */
async function getTask(user, taskId) {
  const taskData = await get(`project:${user}:${taskId}`);
  return taskData || { name: 'Unknown', type: 'unknown', version: 1, timestamp: new Date().toISOString(), features: 'N/A' };
}