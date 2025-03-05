import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { botSocket, BACKEND_URL } from './socket.js';

let lastGeneratedTask = null;

export function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
}

export async function delegateTask(botSocket, botName, command, args) {
  if (botName === 'bot_backend') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();
      await log(`Task ${command} delegated to ${botName} via HTTP: ${JSON.stringify(result)}`);
      return result; // Return result for taskManager.js
    } catch (err) {
      await error(`Failed to delegate task to ${botName} via HTTP: ${err.message}`);
      throw err;
    }
  } else if (botSocket.connected) {
    const taskData = { type: 'command', target: botName, command, args };
    botSocket.emit('command', taskData);
    await log(`Task ${command} delegated to ${botName} via WebSocket`);
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

export { lastGeneratedTask };