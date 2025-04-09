// ai_coders/bot_backend/src/socket.js
// Version: v2025-04-09-06
import io from 'socket.io-client';
import { log, error } from './logger.js';

const BOT_NAME = 'bot_backend';
export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

await log(`🌌 ${BOT_NAME} socket.js v2025-04-09-06 igniting...`, 'INFO');

// Create socket instance
const socket = io(WEBSOCKET_SERVER_URL, {
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

// Promise to resolve when socket is connected and registered
export const botSocket = new Promise((resolve) => {
  socket.on('connect', async () => {
    console.log(`[${new Date().toISOString()}] ${BOT_NAME} connected to cosmic relay at ${WEBSOCKET_SERVER_URL}`);
    await log(`${BOT_NAME} linked to galactic hub with ID: ${socket.id}`, 'INFO');

    if (!isRegistered) {
      socket.emit('register', { name: BOT_NAME, role: 'backend' }, async (ack) => {
        if (ack?.status === 'success') {
          isRegistered = true;
          console.log(`[${new Date().toISOString()}] ${BOT_NAME} registered with cosmic overseer`);
          await log(`${BOT_NAME} synced to cosmic network`, 'INFO');
          resolve(socket); // Resolve with connected socket
          await flushQueue();
        } else {
          await error(`${BOT_NAME} registration failed: ${JSON.stringify(ack)}`);
          // Don’t reject; let reconnection retry
        }
      });
    } else {
      resolve(socket); // Already registered, resolve immediately
      await flushQueue();
    }
  });

  socket.on('connect_error', async (err) => {
    console.error(`[${new Date().toISOString()}] ${BOT_NAME} cosmic link error: ${err.message}`);
    await error(`${BOT_NAME} connection to galactic hub failed: ${err.message}`);
    // Don’t reject; allow reconnection
  });
});

// Socket event handlers (post-resolution)
botSocket.then((socket) => {
  socket.on('connect_error', async (err) => {
    console.error(`[${new Date().toISOString()}] ${BOT_NAME} cosmic link severed: ${err.message}`);
    await error(`${BOT_NAME} connection to galactic hub failed: ${err.message}`);
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[${new Date().toISOString()}] ${BOT_NAME} drifted from cosmic relay. Reason: ${reason}`);
    await error(`${BOT_NAME} disconnected from cosmic network: ${reason}`);
    isRegistered = false;
  });

  socket.on('reconnect_attempt', async (attempt) => {
    console.log(`[${new Date().toISOString()}] ${BOT_NAME} probing cosmic relay, attempt #${attempt}`);
    await log(`${BOT_NAME} seeking galactic reconnection #${attempt}`, 'INFO');
  });

  socket.on('reconnect_failed', async () => {
    console.error(`[${new Date().toISOString()}] ${BOT_NAME} lost in cosmic void after all attempts`);
    await error(`${BOT_NAME} reconnection failed—adrift in the void`);
  });
});

/**
 * Emits a message with queuing during disconnects.
 * @param {string} event - Event name
 * @param {any} data - Event data
 * @param {Function} [callback] - Optional callback
 * @returns {Promise<void>}
 */
export async function emit(event, data, callback) {
  const socket = await botSocket;
  if (socket.connected) {
    socket.emit(event, data, callback);
  } else {
    messageQueue.push({ event, data, callback });
    await log(`🌠 Queued ${event} message due to disconnect`, 'INFO');
  }
}

/**
 * Flushes queued messages when reconnected.
 * @returns {Promise<void>}
 */
async function flushQueue() {
  const socket = await botSocket;
  while (messageQueue.length > 0 && socket.connected) {
    const { event, data, callback } = messageQueue.shift();
    socket.emit(event, data, callback);
    await log(`🚀 Flushed queued ${event} message`, 'INFO');
  }
}

// Heartbeat for stability
setInterval(async () => {
  try {
    const socket = await botSocket;
    if (socket.connected) {
      socket.emit('heartbeat', { bot: BOT_NAME });
      await log(`${BOT_NAME} WebSocket heartbeat: pulsing with cosmic energy!`, 'INFO');
    }
  } catch (err) {
    await error(`Heartbeat failed: ${err.message}`);
  }
}, 30000); // Every 30s

await log(`🌌 ${BOT_NAME} socket.js forged—ready to traverse the cosmic web!`, 'INFO');