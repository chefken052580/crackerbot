import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { botSocket, BACKEND_URL } from './socket.js';

let lastGeneratedTask = null;

export function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
}

export async function delegateTask(botSocket, botName, command, args) {
  const frontendId = args.frontendId || botSocket.id;
  if (botName === 'bot_backend') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args: { ...args, frontendId } }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();
      await log(`Task ${command} delegated to ${botName} via HTTP for frontendId ${frontendId}: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      await error(`Failed to delegate task to ${botName} via HTTP for frontendId ${frontendId}: ${err.message}`);
      throw err;
    }
  } else if (botSocket.connected) {
    const taskData = { type: 'command', target: botName, command, args: { ...args, frontendId } };
    botSocket.emit('command', taskData);
    await log(`Task ${command} delegated to ${botName} via WebSocket for frontendId ${frontendId}`);
  } else {
    await error(`WebSocket not connected, cannot delegate task to ${botName} for frontendId ${frontendId}`);
  }
}

export async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await redisClient.hGet('tasks', taskId);
    if (taskData) {
      const task = JSON.parse(taskData);
      task.status = status;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await log(`Task ${taskId} updated to status: ${status} for frontendId ${task.frontendId}`);
    } else {
      await error(`Task ${taskId} not found for status update`);
    }
  } catch (err) {
    await error('Failed to update task status: ' + err.message);
  }
}

export { lastGeneratedTask };