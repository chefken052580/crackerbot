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

botSocket.on('connect', async () => {
  console.log(`${BOT_NAME} connected to WebSocket server`);
  await log(`${BOT_NAME} connected to WebSocket server with ID: ${botSocket.id}`);
  botSocket.emit('register', {
    name: BOT_NAME,
    role: 'lead',
  });
  // Test emission
  botSocket.emit('test', { from: BOT_NAME, text: "Connection test" }, (ack) => {
    console.log(`${BOT_NAME} received test ack:`, ack);
    log(`${BOT_NAME} received test ack: ${JSON.stringify(ack)}`);
  });
  await log(`${BOT_NAME} sent test event to server`);
  // Force a command test after 5 seconds
  setTimeout(() => {
    const testCommand = { type: 'command', target: 'bot_backend', command: 'testCommand', args: { message: "Test from bot_lead" } };
    botSocket.emit('command', testCommand, (ack) => {
      console.log(`${BOT_NAME} received test command ack:`, ack);
      log(`${BOT_NAME} received test command ack: ${JSON.stringify(ack)}`);
    });
    console.log(`${BOT_NAME} sent test command:`, testCommand);
    log(`${BOT_NAME} sent test command: ${JSON.stringify(testCommand)}`);
  }, 5000);
});

botSocket.onAny((event, ...args) => {
  console.log(`[DEBUG] ${BOT_NAME} received event: ${event}, args:`, JSON.stringify(args));
  log(`[DEBUG] ${BOT_NAME} received event: ${event}, args: ${JSON.stringify(args)}`);
});

botSocket.on('taskResult', (data) => {
  console.log(`${BOT_NAME} received taskResult:`, data);
  log(`${BOT_NAME} received taskResult: ${JSON.stringify(data)}`);
});

botSocket.on('connect_error', (error) => {
  console.error(`${BOT_NAME} WebSocket connection error:`, error.message);
  log(`${BOT_NAME} WebSocket connection error: ${error.message}`);
});

botSocket.on('disconnect', (reason) => {
  console.log(`${BOT_NAME} WebSocket disconnected. Reason:`, reason);
  log(`${BOT_NAME} WebSocket disconnected: ${reason}`);
});

botSocket.on('test_response', (data) => {
  console.log(`${BOT_NAME} received test response:`, data);
  log(`${BOT_NAME} received test response: ${JSON.stringify(data)}`);
});