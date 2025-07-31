// bot_lead/src/resyncState.js
// Version: v2025-07-29-03
/**
 * Resync State Module
 * Restores the task state for a reconnected frontend client.
 * Enhanced by xAI for robust state restoration, session persistence, and handling of incomplete tasks without automatic resumption.
 * Updated to use correct target 'frontend' in sendMessage calls.
 *
 * @version 2025-07-29-03
 * @author CrackerBot Team, enhanced by xAI
 * @module resyncState
 */

import { log } from './logger.js';
import { get, set } from './redisClient.js';
import { sendMessage } from './taskHandlers.js';
import { extensionMap } from './constants.js';

const TECH_STACKS = ['Full Stack', 'MEAN', 'MERN', 'LAMP', 'JAMstack'];
const TASK_TYPES = Object.keys(extensionMap)
  .filter((ext) => !TECH_STACKS.map((s) => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter((ext) => ext !== 'zip');

/**
 * Resyncs the task state for a reconnected frontend client.
 * @async
 * @param {Object} socket - WebSocket instance
 * @param {string} frontendId - Frontend ID
 * @param {string} sessionId - Session ID
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
export default async function resyncState(socket, frontendId, sessionId, ip) {
  try {
    const stateKey = `taskState:${frontendId}`;
    const sessionKey = sessionId ? `session:${sessionId}` : null;
    const userKey = `user:${frontendId}`;

    // Retrieve task state
    let taskState = { step: 'name', taskId: `initial:${frontendId}` };
    const storedState = sessionKey ? await get(sessionKey) : await get(stateKey);
    if (storedState && JSON.parse(storedState)) {
      taskState = JSON.parse(storedState);
    }

    // Retrieve user name
    let effectiveUserName = 'Guest';
    const userData = await get(userKey);
    if (userData && JSON.parse(userData)) {
      effectiveUserName = JSON.parse(userData).name || 'Guest';
    }

    // Fix inconsistent state: if user is not Guest but step is name, advance to choice
    if (effectiveUserName !== 'Guest' && taskState.step === 'name') {
      taskState.step = 'choice';
      await set(stateKey, JSON.stringify(taskState));
      if (sessionKey) await set(sessionKey, JSON.stringify({ ...taskState, user: effectiveUserName }));
      await log(`Fixed inconsistent state in resync for ${frontendId}: advanced from 'name' to 'choice' since user is ${effectiveUserName}`, { frontendId });
    }

    // Handle incomplete building tasks: reset to choice and notify
    if (taskState.step === 'building') {
      const incompleteText = `Previous build for "${taskState.taskName}" was interrupted. Start a new cosmic creation?`;
      await sendMessage(socket, {
        text: incompleteText,
        type: 'error',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Chat', 'Build-Something-Epic'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `incomplete-${taskState.taskId}`,
      });
      taskState.step = 'choice';
      taskState.taskId = `initial:${frontendId}`;
      await set(stateKey, JSON.stringify(taskState));
      if (sessionKey) await set(sessionKey, JSON.stringify({ ...taskState, user: effectiveUserName }));
      await log(`Reset incomplete building task ${taskState.taskId} for ${effectiveUserName} (ID: ${frontendId}) to choice step`, { frontendId });
      return;
    }

    // Send reconnection sync message (static)
    const syncText = `Reconnected, ${effectiveUserName}! Your cosmic state is restored—continue your journey!`;
    await sendMessage(socket, {
      text: syncText,
      type: 'system',
      ip,
      user: effectiveUserName,
      frontendId,
      bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
      messageId: `reconnect-${Date.now()}`,
    });

    // Resync based on task state with static messages
    if (taskState.step === 'name') {
      const welcomeText = `Greetings, cosmic wanderer! Your star awaits naming—shine bright in the Luminara Serenity! 🌠`;
      await sendMessage(socket, {
        text: welcomeText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Type your name below!'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
        messageId: `welcome-${effectiveUserName}-${Date.now()}`,
      });
    } else if (taskState.step === 'choice') {
      const choiceText = `Welcome back, ${effectiveUserName}! Let’s ignite a supernova of code across the universe! 🌌✨`;
      await sendMessage(socket, {
        text: choiceText,
        type: 'success',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Chat', 'Build-Something-Epic'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
        messageId: `welcome-${effectiveUserName}-${Date.now()}`,
      });
    } else if (taskState.step === 'project_name') {
      const projectNameText = `⚒️ Unleash your stellar craft, ${effectiveUserName}! Name your cosmic creation to ignite the forge! 🌌⚡`;
      await sendMessage(socket, {
        text: projectNameText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Name your project!'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff6600, #ff00ff)', color: '#fff' },
        messageId: `${taskState.taskId}-project_name`,
      });
    } else if (taskState.step === 'type') {
      const typeText = `✨ Tech constellation for "${taskState.taskName}", ${effectiveUserName}? Choose your galactic framework! 🌌`;
      await sendMessage(socket, {
        text: typeText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: [...TECH_STACKS, ...TASK_TYPES],
        taskName: taskState.taskName,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
        messageId: `${taskState.taskId}-type`,
      });
    } else if (taskState.step === 'network') {
      const networkText = `🌌 Full Stack cosmos activated, ${effectiveUserName}! Which network will "${taskState.taskName}" orbit?`;
      await sendMessage(socket, {
        text: networkText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['mainnet-beta', 'testnet', 'devnet', 'none'],
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
        messageId: `${taskState.taskId}-network`,
      });
    } else if (taskState.step === 'pending_features') {
      const featuresText = `✨ "${taskState.taskType}" locked for "${taskState.taskName}", ${effectiveUserName}! What features will ignite this stellar creation? 🌠`;
      await sendMessage(socket, {
        text: featuresText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Type your feature details!'],
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
        messageId: `${taskState.taskId}-features`,
      });
    } else if (taskState.step === 'review') {
      const reviewText = `🌟 "${taskState.taskName}" awaits your verdict, ${effectiveUserName}! What's next for this cosmic creation?`;
      await sendMessage(socket, {
        text: reviewText,
        type: 'question',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName,
        frontendId,
        options: ['Restart', 'Refine Project', 'Done'],
        taskName: taskState.taskName,
        taskType: taskState.taskType,
        taskFeatures: taskState.taskFeatures,
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `${taskState.taskId}-review`,
      });
    } else {
      const errorText = `🌌 Cosmic state misaligned for ${effectiveUserName || 'Guest'}! Realigning to default orbit.`;
      taskState = { step: 'choice', taskId: `initial:${frontendId}` };
      await set(stateKey, JSON.stringify(taskState));
      if (sessionKey) await set(sessionKey, JSON.stringify({ ...taskState, user: effectiveUserName }));
      await sendMessage(socket, {
        text: errorText,
        type: 'error',
        taskId: taskState.taskId,
        ip,
        user: effectiveUserName || 'Guest',
        frontendId,
        options: ['Chat', 'Build-Something-Epic'],
        bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        messageId: `error-${Date.now()}`,
      });
    }

    await log(`Resynced state for frontendId ${frontendId}, step: ${taskState.step}`, { frontendId });
  } catch (err) {
    await log(`Failed to resync state for frontendId ${frontendId}: ${err.message}`, { frontendId });
    const errorText = `Cosmic static during resync, ${effectiveUserName || 'Guest'}! Error: ${err.message}. Retry, star voyager?`;
    await sendMessage(socket, {
      text: errorText,
      type: 'error',
      ip,
      user: effectiveUserName || 'Guest',
      frontendId,
      options: ['Retry'],
      bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
      messageId: `error-${Date.now()}`,
    });
  }
}