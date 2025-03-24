// ai_coders/bot_lead/src/socket.js
import io from 'socket.io-client';
import { log } from './logger.js';
import { handleCommand, handleProjectAction } from './commandHandler.js';

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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${BOT_NAME} is live and kicking on ${WEBSOCKET_SERVER_URL}! Socket ID: ${botSocket.id}`);
  await log(`[${timestamp}] ${BOT_NAME} connected to WebSocket server with ID: ${botSocket.id}—ready to lead the charge!`);
  if (!isRegistered) {
    botSocket.emit('register', {
      name: BOT_NAME,
      role: 'lead',
      userId: botSocket.id,
    });
    isRegistered = true;
    console.log(`${BOT_NAME} has officially checked in with the WebSocket crew!`);
    await log(`${BOT_NAME} emitted register event—locked and loaded!`);
  }
});

botSocket.on('connect_error', async (error) => {
  console.error(`${BOT_NAME} hit a snag connecting to WebSocket: ${error.message}`);
  await log(`${BOT_NAME} WebSocket connection error: ${error.message}—retrying with grit!`);
  // Do not emit to bot_frontend here; log only until a frontend connects
});

botSocket.on('disconnect', async (reason) => {
  console.log(`${BOT_NAME} WebSocket went dark. Reason: ${reason}`);
  await log(`${BOT_NAME} WebSocket disconnected: ${reason}—we’ll bounce back stronger!`);
  isRegistered = false;
});

botSocket.on('taskResult', async (data) => {
  console.log(`${BOT_NAME} snagged a taskResult:`, data);
  await log(`${BOT_NAME} received taskResult: ${JSON.stringify(data)}—time to shine!`);
});

botSocket.on('command', async (data) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${BOT_NAME} caught a command:`, data);
  await log(`[${timestamp}] ${BOT_NAME} processing command: ${data.command} from frontendId ${data.frontendId}`);

  try {
    if (data.command === '/project_action') {
      const userName = data.user || 'stranger';
      await handleProjectAction(botSocket, data.action, {
        userName,
        taskId: data.taskId,
        content: data.content,
        fileName: data.fileName,
        frontendId: data.frontendId,
        ip: data.ip || 'unknown',
      });
      console.log(`${BOT_NAME} handled project action "${data.action}" for ${userName}`);
      await log(`${BOT_NAME} executed project action: ${data.action} for task ${data.taskId}`);
    } else {
      await handleCommand(botSocket, data.command, data);
      console.log(`${BOT_NAME} processed command "${data.command}" like a champ!`);
      await log(`${BOT_NAME} handled command: ${data.command} from ${data.frontendId}`);
    }
  } catch (error) {
    console.error(`${BOT_NAME} tripped over command "${data.command}": ${error.message}`);
    await log(`${BOT_NAME} error handling command ${data.command}: ${error.message}`);
    botSocket.emit('message', {
      text: `Cracker Bot hit a wall with "${data.command}"—${error.message}. Retry?`,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: data.user || 'stranger',
      ip: data.ip || 'unknown',
      frontendId: data.frontendId,
    });
  }
});

botSocket.on('message', async (data) => {
  console.log(`${BOT_NAME} received a message (non-command):`, data);
  await log(`${BOT_NAME} got a message: ${JSON.stringify(data)}`);
});