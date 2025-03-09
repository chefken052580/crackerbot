import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { botSocket, BACKEND_URL } from './socket.js';

let lastGeneratedTask = null;

export async function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
  try {
    await redisClient.set('lastGeneratedTask', JSON.stringify(task));
  } catch (err) {
    await error(`Failed to persist lastGeneratedTask: ${err.message}`);
  }
}

export async function delegateTask(botSocketArg, botName, command, args) {
  const socket = botSocketArg || botSocket;
  const frontendId = args.frontendId || socket.id;
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
  } else if (socket.connected) {
    return new Promise((resolve, reject) => {
      const taskData = { type: 'command', target: botName, command, args: { ...args, frontendId } };
      socket.emit('command', taskData);
      socket.once('commandResponse', (data) => {
        if (data.success) {
          resolve(data.response);
          log(`Task ${command} delegated to ${botName} via WebSocket for frontendId ${frontendId}`);
        } else {
          reject(new Error(data.error));
        }
      });
      setTimeout(() => reject(new Error('Task delegation timeout')), 10000);
    });
  } else {
    await error(`WebSocket not connected, cannot delegate task to ${botName} for frontendId ${frontendId}`);
    throw new Error('WebSocket not connected');
  }
}

export async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await redisClient.hGet('tasks', taskId);
    if (!taskData) throw new Error(`Task ${taskId} not found`);
    const task = JSON.parse(taskData);
    task.status = status;
    await redisClient.hSet('tasks', taskId, JSON.stringify(task));
    await log(`Task ${taskId} updated to status: ${status} for frontendId ${task.frontendId}`);
  } catch (err) {
    await error(`Failed to update task status: ${err.message}`);
    throw err;
  }
}

(async () => {
  try {
    const stored = await redisClient.get('lastGeneratedTask');
    if (stored) lastGeneratedTask = JSON.parse(stored);
  } catch (err) {
    await error(`Failed to load lastGeneratedTask: ${err.message}`);
  }
})();

export { lastGeneratedTask };