// ai_coders/bot_backend/src/socket.js
import io from 'socket.io-client';
import { log, error } from './logger.js';
import { initializeTaskExecution } from './taskExecution.js';

const BOT_NAME = 'bot_backend';
export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

console.log(`[${new Date().toISOString()}] ${BOT_NAME} socket.js executing`);
log(`${BOT_NAME} socket.js executing`);

export const botSocket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  transports: ['websocket'],
  path: '/socket.io',
});

let isRegistered = false;

botSocket.on('connect', async () => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} connected to WebSocket server at ${WEBSOCKET_SERVER_URL}`);
  await log(`${BOT_NAME} connected to WebSocket server with ID: ${botSocket.id}`);
  
  if (!isRegistered) {
    botSocket.emit('register', {
      name: BOT_NAME,
      role: 'backend',
    });
    isRegistered = true;
    console.log(`[${new Date().toISOString()}] ${BOT_NAME} emitted register event`);
    await log(`${BOT_NAME} emitted register event`);
    // Move initializeTaskExecution to server.js to ensure it runs once
  }
});

botSocket.on('connect_error', async (err) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} WebSocket connection error: ${err.message}`);
  await error(`${BOT_NAME} WebSocket connection error: ${err.message}`);
  if (!botSocket.connected) {
    setTimeout(() => {
      console.log(`[${new Date().toISOString()}] ${BOT_NAME} attempting manual reconnect`);
      botSocket.connect();
    }, 500);
  }
});

botSocket.on('disconnect', async (reason) => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} WebSocket disconnected. Reason: ${reason}`);
  await error(`${BOT_NAME} WebSocket disconnected: ${reason}`);
  isRegistered = false;
});

botSocket.on('reconnect_attempt', async (attempt) => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} Reconnection attempt #${attempt}`);
  await log(`${BOT_NAME} Reconnection attempt #${attempt}`);
});

botSocket.on('reconnect_failed', async () => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} Reconnection failed after all attempts`);
  await error(`${BOT_NAME} Reconnection failed after all attempts`);
});

console.log(`[${new Date().toISOString()}] ${BOT_NAME} forcing initial connection to ${WEBSOCKET_SERVER_URL}`);
botSocket.connect();