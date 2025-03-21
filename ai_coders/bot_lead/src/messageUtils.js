// ai_coders/bot_lead/src/messageUtils.js
import { log } from './logger.js';
import { getCompletedProjects, getLatestProject, get, hSet, set } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE } from './constants.js';

export async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
  if (!text || text.trim() === '') {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you ghosted me with nothing! Drop some words, fam!`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    return;
  }

  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });
  const buildIntentKeywords = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];
  const hasBuildIntent = buildIntentKeywords.some(keyword => text.toLowerCase().includes(keyword));

  if (hasBuildIntent || text.toLowerCase() === "build something epic!") {
    const taskId = Date.now().toString();
    await hSet('tasks', taskId, { taskId, step: 'tech_stack', user: userName, initialInput: text, status: 'pending', frontendId });
    const stackPrompt = await generateResponse(
      `Alright ${userName}, let’s craft something epic! What’s your tech stack?`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: stackPrompt,
      type: "question",
      taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      options: ["MEAN", "MERN", "LAMP", "JAMstack", "Custom"],
      frontendId,
    });
    await set(`taskState:${frontendId}`, { step: "tech_stack", taskId });
    await log(`Started new task ${taskId} for ${userName} with step 'tech_stack'`);
  } else {
    const taskId = `chat:${Date.now()}`;
    const userInfoKey = `user:frontend:${frontendId}:info`;
    const userInfo = await get(userInfoKey) || {};
    if (!userInfo.favoriteTech) {
      botSocket.emit('message', {
        text: `Yo ${userName}, I’m Cracker Bot—master of code! What’s your favorite tech stack?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else {
      botSocket.emit('message', {
        text: `Hey ${userName}, back for more? I’m Cracker Bot—got ${Object.keys(extensionMap).length} tricks up my sleeve. What’s on your mind?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    }
    await storeMessage(userName, text);
    await log(`Processed general message for ${userName}: ${text}`);
  }
}

export async function fetchProjects(user) {
  try {
    const taskIds = await getCompletedProjects(user);
    if (taskIds.length === 0) return `No completed projects yet, ${user}! Let’s build something epic—hit "Build-Something-Epic"!`;
    const projects = await Promise.all(taskIds.map(id => getTask(user, id)));
    const projectList = projects.map((task, index) => {
      return `${index + 1}. ${task.name} (${task.type} v${task.version}) - ${task.timestamp} | Features: ${task.features.slice(0, 50)}${task.features.length > 50 ? '...' : ''}`;
    }).join('\n');
    return `Your completed stash, ${user}:\n${projectList}\nType "/download" for the latest or start a new vibe!`;
  } catch (err) {
    await log(`Fetching projects for ${user} crashed: ${err.message}`);
    return `Glitch fetching your stash, ${user}—try again soon!`;
  }
}

async function getTask(user, taskId) {
  const taskData = await get(`project:${user}:${taskId}`);
  return taskData || { name: "Unknown", type: "unknown", version: 1, timestamp: new Date().toLocaleTimeString(), features: "N/A" };
}