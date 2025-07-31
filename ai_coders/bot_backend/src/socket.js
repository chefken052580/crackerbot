// bot_backend/src/socket.js
// Version: v2025-07-26-01
/**
 * WebSocket Client Module
 * Establishes CrackerBot’s cosmic connection to the WebSocket server with retry logic and galactic reliability.
 * Enhanced by xAI for robust reconnection, error handling, and immediate progress emission on task receipt.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module socket
 */

import { io } from 'socket.io-client';
import { log, error, debug } from './logger.js';
import { executeTask } from './taskExecution.js';

/**
 * Socket.IO client instance
 * @type {Object|null}
 */
export let botSocket = null;

/**
 * Emits an event with retry logic and cosmic logging.
 * @async
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
export async function emit(event, data) {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (!botSocket.connected) throw new Error('WebSocket not connected');
      await debug(`Emitting ${event} with data: ${JSON.stringify(data).slice(0, 100)}...`, { event });
      botSocket.emit(event, data);
      await log(`Emitted ${event} successfully`, { event });
      return;
    } catch (err) {
      attempt++;
      await error(`Failed to emit ${event}, attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt === maxRetries) throw new Error(`Failed to emit ${event} after ${maxRetries} attempts: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Initializes WebSocket connection with exponential backoff.
 * @returns {Promise<Object>} Connected Socket.IO client
 */
export const botSocketPromise = new Promise((resolve, reject) => {
  const maxRetries = 10;
  let attempt = 0;

  const connect = async () => {
    try {
      const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://websocket_server:5002';
      await log(`bot_backend attempting connection #${attempt + 1}/${maxRetries} to ${WEBSOCKET_URL}`);
      await debug(`Starting connection attempt #${attempt + 1}`);

      botSocket = io(WEBSOCKET_URL, {
        transports: ['websocket'],
        reconnection: false, // Use manual retries
        timeout: 60000,
        path: '/socket.io',
      });

      botSocket.on('connect', async () => {
        await log(`bot_backend linked to galactic hub with ID: ${botSocket.id}`);
        botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
        resolve(botSocket);
      });

      botSocket.on('message', async (data) => {
        try {
          const { text, type, frontendId, ip, user, sessionId, taskId, taskName, taskType, taskFeatures } = data;
          await log(`Received message: ${JSON.stringify({ text, type, frontendId, ip, user, sessionId, taskId })}`);
          if (type === 'task_execution') {
            // Send immediate 0% progress to prevent stuck builds
            const socket = await botSocketPromise;
            await socket.emit('message', {
              type: 'progressUpdate',
              taskId,
              progress: 0,
              text: `CrackerBot’s cosmic pulse: Igniting build for ${taskName}...`,
              from: 'CrackerBot Prime',
              target: 'bot_frontend',
              frontendId,
              ip,
              taskName,
              taskType,
              taskFeatures,
              messageId: `${taskId}-progress-0`,
              bubbleStyle: { background: 'linear-gradient(135deg, #ff0066, #ffcc00)', color: '#fff' },
              timestamp: new Date().toISOString(),
            });
            await executeTask(botSocket, { taskId, taskName, taskType, taskFeatures, frontendId, ip, user, sessionId });
          }
        } catch (err) {
          await error(`Failed to handle message: ${err.message}`);
        }
      });

      botSocket.on('connect_error', async (err) => {
        await error(`bot_backend connection failed: ${err.message}`);
        if (attempt < maxRetries - 1) {
          attempt++;
          const delay = 1000 * Math.pow(2, attempt);
          await debug(`Retrying connection in ${delay}ms, attempt ${attempt + 1}/${maxRetries}`);
          setTimeout(connect, delay);
        } else {
          reject(new Error(`bot_backend failed to connect after ${maxRetries} attempts: ${err.message}`));
        }
      });

      botSocket.on('error', async (err) => {
        await error(`WebSocket error: ${err.message}`);
      });

      botSocket.on('heartbeat', async () => {
        await log(`bot_backend WebSocket heartbeat: radiating cosmic energy!`);
      });
    } catch (err) {
      await error(`Connection setup failed: ${err.message}`);
      if (attempt < maxRetries - 1) {
        attempt++;
        const delay = 1000 * Math.pow(2, attempt);
        await debug(`Retrying connection in ${delay}ms, attempt ${attempt + 1}/${maxRetries}`);
        setTimeout(connect, delay);
      } else {
        reject(new Error(`Connection setup failed after ${maxRetries} attempts: ${err.message}`));
      }
    }
  };

  connect();
});

(async () => {
  try {
    await log('🌌 bot_backend socket.js v2025-07-26-01 igniting...');
    await botSocketPromise;
    await log('🌌 bot_backend socket.js forged—ready to traverse the cosmic web!');
  } catch (err) {
    await error(`bot_backend socket.js supernova-failed: ${err.message}`);
    process.exit(1);
  }
})();