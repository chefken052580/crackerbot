import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { botSocket } from './socket.js';

let lastGeneratedTask = null;

export async function setLastGeneratedTask(task) {
  lastGeneratedTask = task;
  try {
    await redisClient.set('lastGeneratedTask', JSON.stringify(task));
    await log(`Persisted lastGeneratedTask: ${task.name}`);
  } catch (err) {
    await error(`Failed to persist lastGeneratedTask: ${err.message}`);
  }
}

export async function delegateTask(botSocketArg, botName, command, args) {
  const socket = botSocketArg || botSocket;
  const frontendId = args.frontendId || socket.id;

  console.log(`Socket state: connected=${socket.connected}, id=${socket.id}`);
  await log(`Socket state for delegation: connected=${socket.connected}, id=${socket.id}`);
  if (!socket.connected) {
    await error(`WebSocket not connected, cannot delegate task to ${botName} for frontendId ${frontendId}`);
    throw new Error('WebSocket not connected');
  }

  const taskData = { type: 'command', target: botName, command, args: { ...args, frontendId } };
  await log(`Delegating task to ${botName}: ${JSON.stringify(taskData)}`);
  console.log(`Emitting command to WebSocket server: ${JSON.stringify(taskData)}`);

  return new Promise((resolve, reject) => {
    try {
      socket.emit('command', taskData, (ack) => {
        console.log(`Server acknowledged command: ${JSON.stringify(ack)}`);
        log(`Server acknowledged command: ${JSON.stringify(ack)}`);
      });
      console.log(`Command emitted to ${botName} via socket ${socket.id}`);
    } catch (err) {
      console.error(`Error during command emission: ${err.message}`);
      reject(err);
      return;
    }

    socket.once('taskResult', async (data) => {
      console.log(`Received taskResult: ${JSON.stringify(data)}`);
      await log(`Task ${command} completed by ${botName} for frontendId ${frontendId}`);
      resolve(data);
    });

    setTimeout(async () => {
      await error(`Task ${command} delegation to ${botName} timed out for frontendId ${frontendId}`);
      reject(new Error('Task delegation timeout'));
    }, 30000);
  }).catch(async (err) => {
    await error(`Promise rejection in delegateTask: ${err.message}`);
    throw err;
  });
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
    await log('stateManager.js version 2025-03-15-3 loaded');
    const stored = await redisClient.get('lastGeneratedTask');
    if (stored) lastGeneratedTask = JSON.parse(stored);
  } catch (err) {
    await error(`Failed to load lastGeneratedTask: ${err.message}`);
  }
})();

export { lastGeneratedTask };