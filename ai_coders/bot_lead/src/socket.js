// ai_coders/bot_lead/src/socket.js (ESM, v2025-03-26-4)
/**
 * Lead Bot WebSocket Module
 * Forges bot_lead’s interstellar link to the WebSocket server with flair and grit.
 * Registers as the cosmic lead and handles commands with stellar precision.
 * 
 * @version 2025-03-26-4
 * @author CrackerBot Team, enhanced by xAI
 */

import io from 'socket.io-client';
import { log, error } from './logger.js';
import { handleCommand, handleProjectAction } from './commandHandler.js';

const BOT_NAME = "bot_lead";
export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

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

/**
 * Registers bot_lead with the WebSocket server in a blaze of cosmic glory.
 */
const registerBot = async () => {
  if (!botSocket.connected) {
    await error(`${BOT_NAME} signal lost—registration paused until we’re back in orbit!`);
    return;
  }
  botSocket.emit('register', {
    name: BOT_NAME,
    role: 'lead',
    userId: botSocket.id,
  });
  await log(`${BOT_NAME} fired register signal—locked and loaded with ID: ${botSocket.id}!`);
  isRegistered = true;
};

// Warp in with cosmic flair
botSocket.on('connect', async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${BOT_NAME} is live and kicking on ${WEBSOCKET_SERVER_URL}! Socket ID: ${botSocket.id}`);
  await log(`[${timestamp}] ${BOT_NAME} warped into WebSocket grid with ID: ${botSocket.id}—leading the cosmic charge!`);
  if (!isRegistered) {
    await registerBot();
  }
});

// Handle connection glitches with grit
botSocket.on('connect_error', async (err) => {
  console.error(`${BOT_NAME} hit a snag connecting to WebSocket: ${err.message}`);
  await error(`${BOT_NAME} WebSocket link warped out: ${err.message}—retrying with stellar resolve!`);
});

// Reconnect with triumphant flair
botSocket.on('reconnect', async (attempt) => {
  console.log(`${BOT_NAME} reconnected after ${attempt} attempts`);
  await log(`${BOT_NAME} blasted back online after ${attempt} attempts—unbreakable!`);
  if (!isRegistered) {
    await registerBot();
  }
});

// Disconnection with a vow to return
botSocket.on('disconnect', async (reason) => {
  console.log(`${BOT_NAME} WebSocket went dark. Reason: ${reason}`);
  await error(`${BOT_NAME} WebSocket signal dropped: ${reason}—we’ll rise again!`);
  isRegistered = false;
});

// Heartbeat to keep the galaxy pulsing
setInterval(async () => {
  if (botSocket.connected) {
    await log(`${BOT_NAME} WebSocket heartbeat: radiating cosmic energy!`);
  } else {
    await error(`${BOT_NAME} WebSocket heartbeat: signal faded—reconnecting...`);
  }
}, 10000);

// Task result handler with stellar precision
botSocket.on('taskResult', async (data) => {
  console.log(`${BOT_NAME} snagged a taskResult:`, data);
  await log(`${BOT_NAME} intercepted taskResult: ${JSON.stringify(data)}—deploying brilliance!`);
});

// Command handler with cosmic execution
botSocket.on('command', async (data) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${BOT_NAME} caught a command:`, data);
  const command = data.text && data.text.startsWith('/') ? data.text.split(' ')[0].substring(1) : data.command;
  await log(`[${timestamp}] ${BOT_NAME} decoding command: ${command} from frontendId ${data.frontendId}`);

  try {
    if (data.command === '/project_action' || command === 'project_action') {
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
    } else if (command) {
      await handleCommand(botSocket, command, data);
      console.log(`${BOT_NAME} processed command "${command}" like a champ!`);
      await log(`${BOT_NAME} nailed command: ${command} from ${data.frontendId}`);
    } else {
      throw new Error('No valid command found in message');
    }
  } catch (err) {
    console.error(`${BOT_NAME} tripped over command "${command || 'unknown'}": ${err.message}`);
    await error(`${BOT_NAME} command "${command || 'unknown'}" misfired: ${err.message}`);
    botSocket.emit('message', {
      text: `CrackerBot Prime hit a cosmic snag with "${command || 'unknown'}"—${err.message}. Retry, star? 🌌`,
      type: 'error',
      from: 'CrackerBot Prime',
      target: 'bot_frontend',
      user: data.user || 'stranger',
      ip: data.ip || 'unknown',
      frontendId: data.frontendId,
    });
  }
});

// Message handler with command detection
botSocket.on('message', async (data) => {
  console.log(`${BOT_NAME} received a message:`, data);
  await log(`${BOT_NAME} snagged message: ${JSON.stringify(data)}`);
  // Delegate to taskManager.js to handle message processing
});

// Ignite the cosmic link
console.log(`${BOT_NAME} initializing WebSocket link to ${WEBSOCKET_SERVER_URL}`);
await log(`${BOT_NAME} booting up—warping into WebSocket orbit...`);