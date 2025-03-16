import io from 'socket.io-client';
import { log } from './logger.js';

const BOT_NAME = "bot_lead";
export const WEBSOCKET_SERVER_URL = 'wss://websocket-visually-sterling-spider.ngrok-free.app';

export const botSocket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket'],
  path: '/socket.io',
});

let isRegistered = false;

botSocket.on('connect', async () => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} connected to WebSocket server at ${WEBSOCKET_SERVER_URL}`);
  await log(`[${new Date().toISOString()}] ${BOT_NAME} connected to WebSocket server with ID: ${botSocket.id}`);
  
  if (!isRegistered) {
    botSocket.emit('register', {
      name: BOT_NAME,
      role: 'lead',
      userId: botSocket.id,
    });
    isRegistered = true;
    console.log(`${BOT_NAME} emitted register event`);
    await log(`${BOT_NAME} emitted register event`);
  }
});

botSocket.on('connect_error', async (error) => {
  console.error(`${BOT_NAME} WebSocket connection error:`, error.message);
  await log(`${BOT_NAME} WebSocket connection error: ${error.message}`);
});

botSocket.on('disconnect', async (reason) => {
  console.log(`${BOT_NAME} WebSocket disconnected. Reason:`, reason);
  await log(`${BOT_NAME} WebSocket disconnected: ${reason}`);
  isRegistered = false;
});

botSocket.on('taskResult', async (data) => {
  console.log(`${BOT_NAME} received taskResult:`, data);
  await log(`${BOT_NAME} received taskResult: ${JSON.stringify(data)}`);
});