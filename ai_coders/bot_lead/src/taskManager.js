const WebSocket = require('ws');
const logger = require('./logger');

let wsClient;
const WEBSOCKET_SERVER_URL = 'ws://localhost:5002'; // Adjust URL if needed
const RECONNECT_DELAY = 5000;
const tasks = new Map();

function connectToWebSocket() {
  wsClient = new WebSocket(WEBSOCKET_SERVER_URL);

  wsClient.on('open', () => {
    logger.log('Task Manager connected to WebSocket server');
    wsClient.send(JSON.stringify({ type: 'register', name: 'bot_lead', role: 'lead' }));
  });

  wsClient.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      logger.log('Task Manager received:', message);
      handleTask(message);
    } catch (err) {
      logger.error(`Failed to parse message: ${err.message}`);
    }
  });

  wsClient.on('close', (code, reason) => {
    logger.log(`Task Manager WebSocket connection closed (${code} - ${reason}), reconnecting in ${RECONNECT_DELAY / 1000} seconds...`);
    setTimeout(connectToWebSocket, RECONNECT_DELAY);
  });

  wsClient.on('error', (error) => {
    logger.error(`Task Manager WebSocket error: ${error.message}`);
  });
}

function handleTask(task) {
  switch (task.type) {
    case 'command':
      processCommand(task.command);
      break;
    case 'general_message':
      processGeneralMessage(task.text);
      break;
    case 'task_update':
      updateTaskStatus(task.taskId, task.status);
      break;
    default:
      logger.log(`Unhandled task type: ${task.type}`);
  }
}

function processCommand(command) {
  switch (command) {
    case '/start_task':
      createNewTask('Example Task');
      break;
    case '/stop_bots':
      delegateTask('bot_backend', 'stopAllTasks', {});
      break;
    default:
      logger.log(`Unhandled command: ${command}`);
  }
}

function processGeneralMessage(text) {
  if (text.includes('project')) {
    delegateTask('bot_frontend', 'handleProject', { projectName: 'New Project' });
  } else if (text.includes('task')) {
    delegateTask('bot_backend', 'executeTask', { taskName: 'Some Task' });
  }
}

function createNewTask(taskDetails) {
  const taskId = Date.now().toString();
  tasks.set(taskId, { taskId, details: taskDetails, status: 'pending' });
  logger.log(`Created new task: ${taskId} - ${taskDetails}`);
  delegateTask('bot_frontend', 'startNewTask', { taskId, taskDetails });
}

function updateTaskStatus(taskId, status) {
  if (tasks.has(taskId)) {
    tasks.get(taskId).status = status;
    logger.log(`Task ${taskId} updated to status: ${status}`);
  } else {
    logger.error(`Task ${taskId} not found for status update.`);
  }
}

function delegateTask(botName, command, args) {
  if (wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({
      type: 'command',
      target: botName,
      command: command,
      args: args
    }));
    logger.log(`Task ${command} delegated to ${botName}`);
  } else {
    logger.error(`WebSocket not open, cannot delegate task to ${botName}`);
  }
}

module.exports = {
  connectToWebSocket
};

// Start the connection when this module is loaded
connectToWebSocket();