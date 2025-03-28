// ai_coders/bot_backend/src/socket.js
// Version: v2025-03-28-14
import io from 'socket.io-client';
import { log, error } from './logger.js';
import { initializeTaskExecution } from './taskExecution.js';

const BOT_NAME = 'bot_backend';
export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

await log(`🌌 ${BOT_NAME} socket.js v2025-03-28-14 igniting...`, 'INFO');

export const botSocket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  transports: ['websocket'],
  path: '/socket.io',
});

// Message queue for reliability during disconnects
let messageQueue = [];
let isRegistered = false;

/**
 * Emits a message with queuing during disconnects.
 * @param {string} event - Event name
 * @param {any} data - Event data
 * @param {Function} [callback] - Optional callback
 * @returns {void}
 */
function emitWithQueue(event, data, callback) {
  if (botSocket.connected) {
    botSocket.emit(event, data, callback);
  } else {
    messageQueue.push({ event, data, callback });
    log(`🌠 Queued ${event} message due to disconnect`, 'INFO');
  }
}

/**
 * Flushes queued messages when reconnected.
 * @returns {Promise<void>}
 */
async function flushQueue() {
  while (messageQueue.length > 0 && botSocket.connected) {
    const { event, data, callback } = messageQueue.shift();
    botSocket.emit(event, data, callback);
    await log(`🚀 Flushed queued ${event} message`, 'INFO');
  }
}

botSocket.on('connect', async () => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} connected to cosmic relay at ${WEBSOCKET_SERVER_URL}`);
  await log(`${BOT_NAME} linked to galactic hub with ID: ${botSocket.id}`, 'INFO');
  
  if (!isRegistered) {
    emitWithQueue('register', { name: BOT_NAME, role: 'backend' }, async (ack) => {
      if (ack?.status === 'success') {
        isRegistered = true;
        console.log(`[${new Date().toISOString()}] ${BOT_NAME} registered with cosmic overseer`);
        await log(`${BOT_NAME} synced to cosmic network`, 'INFO');
        initializeTaskExecution(); // Ensure task execution starts post-registration
      } else {
        await error(`${BOT_NAME} registration failed: ${JSON.stringify(ack)}`);
      }
    });
  }
  await flushQueue();
});

botSocket.on('connect_error', async (err) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} cosmic link severed: ${err.message}`);
  await error(`${BOT_NAME} connection to galactic hub failed: ${err.message}`);
});

botSocket.on('disconnect', async (reason) => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} drifted from cosmic relay. Reason: ${reason}`);
  await error(`${BOT_NAME} disconnected from cosmic network: ${reason}`);
  isRegistered = false;
});

botSocket.on('reconnect_attempt', async (attempt) => {
  console.log(`[${new Date().toISOString()}] ${BOT_NAME} probing cosmic relay, attempt #${attempt}`);
  await log(`${BOT_NAME} seeking galactic reconnection #${attempt}`, 'INFO');
});

botSocket.on('reconnect_failed', async () => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} lost in cosmic void after all attempts`);
  await error(`${BOT_NAME} reconnection failed—adrift in the void`);
});

// Heartbeat for stability
setInterval(() => {
  if (botSocket.connected) {
    botSocket.emit('heartbeat', { bot: BOT_NAME });
    log(`${BOT_NAME} WebSocket heartbeat: pulsing with cosmic energy!`, 'INFO');
  }
}, 30000); // Every 30s

// Export wrapped emit function for use in other files
export function emit(event, data, callback) {
  emitWithQueue(event, data, callback);
}

await log(`🌌 ${BOT_NAME} socket.js forged—ready to traverse the cosmic web!`, 'INFO');