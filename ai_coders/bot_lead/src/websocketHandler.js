// ai_coders/bot_lead/src/websocketHandler.js
import { Server } from 'socket.io';
import http from 'http';
import { handleCommand } from './commandHandler.js';
import { handleMessage, handleTaskResponse } from './taskManager.js'; // Updated to include handleMessage
import { botSocket } from './socket.js'; // Fixed import
import { log } from './logger.js';

const PORT = process.env.PORT || 5001;

const server = http.createServer();
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

export function initializeWebSocket() {
  io.on('connection', async (socket) => {
    await log('Client connected to WebSocket: ' + socket.id);

    socket.on('command', async (data) => {
      await log('Received command from client: ' + JSON.stringify(data));
      const response = await handleCommand(botSocket, data.command, data);
      io.emit('commandResponse', { ...response, target: 'bot_frontend' });
    });
  });

  botSocket.on('message', async (data) => {
    await log('Bot received message: ' + JSON.stringify(data));
    await handleMessage(botSocket, data);
  });

  botSocket.on('command', async (data) => {
    await log('Bot received command: ' + JSON.stringify(data));
    const response = await handleCommand(botSocket, data.command, data);
    botSocket.emit('commandResponse', { success: true, ...response, target: 'bot_frontend' });
  });

  botSocket.on('taskResponse', async (data) => {
    await log('Bot received task response: ' + JSON.stringify(data));
    await handleTaskResponse(botSocket, data.taskId, data.answer, data.user || 'stranger', data.tone || 'default');
  });

  server.listen(PORT, () => console.log(`Cracker Bot Lead on port ${PORT}`));
}