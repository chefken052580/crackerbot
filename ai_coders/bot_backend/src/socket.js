// ai_coders/bot_backend/src/socket.js
// Version: v2025-04-10-10
/* CrackerBot’s cosmic relay hub—linking backend to the galactic network with supernova precision! 🌌 */

import io from 'socket.io-client';
import { log, error, debug } from './logger.js';

const BOT_NAME = 'bot_backend';
export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 3000; // 3s base delay for retries
const CONNECTION_TIMEOUT = 10000; // 10s timeout per Socket.IO attempt

await log(`🌌 ${BOT_NAME} socket.js v2025-04-10-10 igniting...`, 'INFO');

// Message queue for reliability during disconnects
let messageQueue = [];
let isRegistered = false;

// Promise to resolve or reject based on connection success or ultimate failure
export const botSocket = new Promise((resolve, reject) => {
  const socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: false, // Managed manually below
    transports: ['websocket'],
    path: '/socket.io',
    timeout: CONNECTION_TIMEOUT,
  });

  let attempt = 0;

  const connectWithRetry = async () => {
    if (attempt >= MAX_RETRIES) {
      const errMsg = `${BOT_NAME} failed to connect after ${MAX_RETRIES} attempts`;
      console.error(`[${new Date().toISOString()}] ${errMsg}`);
      await error(errMsg);
      reject(new Error(errMsg));
      return;
    }

    attempt++;
    await log(`${BOT_NAME} attempting connection #${attempt}/${MAX_RETRIES} to ${WEBSOCKET_SERVER_URL}`, 'INFO');
    await debug(`Starting connection attempt #${attempt}`, { attempt, url: WEBSOCKET_SERVER_URL });
    socket.connect();

    socket.on('connect', async () => {
      console.log(`[${new Date().toISOString()}] ${BOT_NAME} connected to cosmic relay at ${WEBSOCKET_SERVER_URL}`);
      await log(`${BOT_NAME} linked to galactic hub with ID: ${socket.id}`, 'INFO');

      if (!isRegistered) {
        socket.emit('register', { name: BOT_NAME, role: 'backend' }, async (ack) => {
          if (ack?.status === 'success') {
            isRegistered = true;
            console.log(`[${new Date().toISOString()}] ${BOT_NAME} registered with cosmic overseer`);
            await log(`${BOT_NAME} synced to cosmic network`, 'INFO');
            resolve(socket);
            await flushQueue();
          } else {
            await error(`${BOT_NAME} registration failed: ${JSON.stringify(ack)}`);
            socket.disconnect();
            setTimeout(connectWithRetry, INITIAL_RETRY_DELAY * attempt); // Exponential backoff
          }
        });
      } else {
        resolve(socket);
        await flushQueue();
      }
    });

    socket.on('connect_error', async (err) => {
      console.error(`[${new Date().toISOString()}] ${BOT_NAME} cosmic link error on attempt #${attempt}: ${err.message}`);
      await error(`${BOT_NAME} connection failed: ${err.message}`);
      socket.disconnect();
      setTimeout(connectWithRetry, INITIAL_RETRY_DELAY * attempt); // Exponential backoff
    });
  };

  connectWithRetry();
});

// Socket event handlers (post-resolution)
botSocket.then((socket) => {
  socket.on('connect', async () => {
    await log(`${BOT_NAME} WebSocket reconnected—cosmic channels live!`, 'INFO');
    await flushQueue();
  });

  socket.on('connect_error', async (err) => {
    console.error(`[${new Date().toISOString()}] ${BOT_NAME} cosmic link severed: ${err.message}`);
    await error(`${BOT_NAME} connection error: ${err.message}`);
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[${new Date().toISOString()}] ${BOT_NAME} drifted from cosmic relay. Reason: ${reason}`);
    await error(`${BOT_NAME} disconnected: ${reason}`);
    isRegistered = false;
  });
}).catch((err) => {
  console.error(`[${new Date().toISOString()}] ${BOT_NAME} socket promise rejected: ${err.message}`);
});

/**
 * Emits a message with queuing during disconnects.
 * @param {string} event - Event name
 * @param {any} data - Event data (e.g., taskResult with jsonContent)
 * @param {Function} [callback] - Optional callback for acknowledgment
 * @returns {Promise<void>}
 */
export async function emit(event, data, callback) {
  try {
    const socket = await botSocket;
    if (socket.connected) {
      socket.emit(event, data, callback);
      await debug(`Emitted ${event} successfully`, { event, data: JSON.stringify(data).slice(0, 100) });
    } else {
      messageQueue.push({ event, data, callback });
      await log(`🌠 Queued ${event} message due to disconnect`, 'INFO');
    }
  } catch (err) {
    messageQueue.push({ event, data, callback });
    await error(`Emit failed for ${event}: ${err.message}`);
  }
}

/**
 * Flushes queued messages when reconnected.
 * @returns {Promise<void>}
 */
async function flushQueue() {
  try {
    const socket = await botSocket;
    while (messageQueue.length > 0 && socket.connected) {
      const { event, data, callback } = messageQueue.shift();
      socket.emit(event, data, callback);
      await log(`🚀 Flushed queued ${event} message`, 'INFO');
      await debug(`Flushed message details`, { event, data: JSON.stringify(data).slice(0, 100) });
    }
  } catch (err) {
    await error(`Failed to flush queue: ${err.message}`);
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
}, 30000);

await log(`🌌 ${BOT_NAME} socket.js forged—ready to traverse the cosmic web!`, 'INFO');