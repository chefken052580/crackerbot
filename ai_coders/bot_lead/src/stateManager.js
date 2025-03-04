// ai_coders/bot_lead/src/stateManager.js
import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';

export let lastGeneratedTask = null;

export function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
}

export async function delegateTask(botSocket, botName, command, args) {
  if (botSocket.connected) {
    const taskData = { type: 'command', target: botName, command, args };
    botSocket.emit('command', taskData);
    await log(`Task ${command} delegated to ${botName}`);
  } else {
    await error(`WebSocket not connected, cannot delegate task to ${botName}`);
  }
}

export async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await redisClient.hGet('tasks', taskId);
    if (taskData) {
      const task = JSON.parse(taskData);
      task.status = status;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await log(`Task ${taskId} updated to status: ${status}`);
    } else {
      await error(`Task ${taskId} not found for status update`);
    }
  } catch (err) {
    await error('Failed to update task status: ' + err.message);
  }
}