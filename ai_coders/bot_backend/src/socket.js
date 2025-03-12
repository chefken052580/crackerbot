import io from 'socket.io-client';

const BOT_NAME = "bot_backend";
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

botSocket.on('connect', () => {
  console.log(`${BOT_NAME} connected to WebSocket server`);
  botSocket.emit('register', {
    name: BOT_NAME,
    role: 'backend',
  });
});

botSocket.on('command', (data) => {
  console.log(`${BOT_NAME} received command:`, data.command, data.args);
  // taskExecution.js handles this, no response needed here
});

botSocket.on('connect_error', (error) => {
  console.error(`${BOT_NAME} WebSocket connection error:`, error.message);
});

botSocket.on('disconnect', (reason) => {
  console.log(`${BOT_NAME} WebSocket disconnected. Reason:`, reason);
});