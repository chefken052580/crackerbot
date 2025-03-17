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

  if (!socket.connected) {
    await error(`WebSocket not connected, cannot delegate task to ${botName} for frontendId ${frontendId}`);
    throw new Error('WebSocket not connected');
  }

  // Generate a unique requestId and include leadId (socket ID of bot_lead)
  const requestId = Date.now().toString(); // Simple unique identifier
  const taskData = {
    type: 'message',
    commandFlag: true, // Flag to identify as a command
    target: botName,
    command,
    args: { ...args, frontendId, requestId, leadId: socket.id },
  };

  // Log task delegation with requestId and leadId
  await log(`Delegating task to ${botName} with requestId ${requestId} and leadId ${socket.id}: ${JSON.stringify(taskData)}`);
  console.log(`[${new Date().toISOString()}] Emitting command as message to WebSocket server: ${JSON.stringify(taskData)}`);
  console.log(`[${new Date().toISOString()}] Socket state - connected: ${socket.connected}, id: ${socket.id}, transport: ${socket.io.engine.transport.name}`);

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    let callbackReceived = false;

    const emitCommand = () => {
      attempts++;
      console.log(`[${new Date().toISOString()}] Attempt ${attempts}/${maxAttempts} to emit command as message to ${botName}, socket.connected: ${socket.connected}`);

      socket.emit('message', taskData, (ack) => {
        callbackReceived = true;
        if (ack && ack.status === 'success') {
          console.log(`[${new Date().toISOString()}] Command-as-message acknowledged by server: ${JSON.stringify(ack)}`);
          log(`Command-as-message acknowledged by server: ${JSON.stringify(ack)}`);
        } else {
          console.error(`[${new Date().toISOString()}] Command-as-message acknowledgment failed: ${JSON.stringify(ack)}`);
          if (attempts >= maxAttempts) {
            reject(new Error(`Command-as-message acknowledgment failed after ${maxAttempts} attempts: ${ack?.message || 'No response'}`));
          }
        }
      });
      console.log(`[${new Date().toISOString()}] Command-as-message emitted to ${botName} via socket ${socket.id}`);

      if (attempts < maxAttempts && !callbackReceived) {
        setTimeout(() => {
          if (!callbackReceived) {
            console.log(`[${new Date().toISOString()}] No callback received for attempt ${attempts}, retrying...`);
            emitCommand();
          }
        }, 5000);
      }
    };

    emitCommand();

    // Listen for taskResult with matching requestId
    const taskResultHandler = (data) => {
      console.log(`[${new Date().toISOString()}] Received taskResult for requestId ${data.requestId}: ${JSON.stringify(data)}`);
      if (data.requestId === requestId) {
        socket.off('taskResult', taskResultHandler); // Clean up listener
        if (!data.error) {
          log(`Task ${command} completed by ${botName} for frontendId ${frontendId} with requestId ${requestId}`);
          resolve(data);
        } else {
          error(`Task ${command} failed for frontendId ${frontendId} with requestId ${requestId}: ${data.error}`);
          reject(new Error(data.error));
        }
      }
    };

    socket.on('taskResult', taskResultHandler);

    setTimeout(() => {
      if (!callbackReceived) {
        socket.off('taskResult', taskResultHandler); // Clean up on timeout
        error(`Task ${command} delegation to ${botName} timed out for frontendId ${frontendId} after ${maxAttempts} attempts with requestId ${requestId}`);
        reject(new Error('Task delegation timeout after 30s'));
      }
    }, 30000);
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
    await log('stateManager.js version 2025-03-17-1 loaded'); // Version bump for this update
    const stored = await redisClient.get('lastGeneratedTask');
    if (stored) {
      lastGeneratedTask = JSON.parse(stored);
      await log(`Loaded lastGeneratedTask from Redis: ${lastGeneratedTask.name}`);
    }
  } catch (err) {
    await error(`Failed to load lastGeneratedTask: ${err.message}`);
  }
})();

export { lastGeneratedTask };