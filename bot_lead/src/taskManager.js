const WebSocket = require('ws');
const logger = require('./logger');

let wsClient;

function connectToWebSocket() {
  wsClient = new WebSocket('ws://localhost:5002'); // Adjust URL as needed

  wsClient.on('open', () => {
    logger.log('Task Manager connected to WebSocket server');
    wsClient.send(JSON.stringify({ type: 'register', name: 'bot_lead', role: 'lead' }));
  });

  wsClient.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data);
      logger.log('Task Manager received:', message);
      handleTask(message);
    } catch (err) {
      logger.error(`Failed to parse message: ${err.message}`);
    }
  });

  wsClient.on('close', () => {
    logger.log('Task Manager WebSocket connection closed, attempting to reconnect...');
    setTimeout(connectToWebSocket, 5000); // Retry after 5 seconds
  });

  wsClient.on('error', (error) => {
    logger.error(`Task Manager WebSocket error: ${error.message}`);
  });
}

function handleTask(task) {
  if (task.type === 'command') {
    switch (task.command) {
      case '/start_task':
        delegateTask('bot_frontend', 'startNewTask', { taskDetails: 'Example Task' });
        break;
      case '/stop_bots':
        delegateTask('bot_backend', 'stopAllTasks', {});
        break;
      // Add more cases for different commands
      default:
        logger.log(`Unhandled command: ${task.command}`);
    }
  } else if (task.type === 'general_message') {
    // Handle general messages
    if (task.text.includes('project')) {
      delegateTask('bot_frontend', 'handleProject', { projectName: 'New Project' });
    } else if (task.text.includes('task')) {
      delegateTask('bot_backend', 'executeTask', { taskName: 'Some Task' });
    }
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