// bot_lead/src/socket.js
// Version: v2025-07-23-02
/**
 * WebSocket Client Module
 * Establishes CrackerBot’s cosmic connection to the WebSocket server with retry logic and galactic reliability.
 * Enhanced by xAI for robust reconnection and error handling.
 *
 * @version 2025-07-23-02
 * @author CrackerBot Team, enhanced by xAI
 * @module socket
 */

import { io } from 'socket.io-client';
import { log, error } from './logger.js';
import { executeCommand } from './commandHandler.js';
import { handleTaskResponse, sendMessage } from './taskHandlers.js';
import { redisClient } from './redisClient.js';
import { generateResponse } from './aiHelper.js';

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
      await log(`Emitting ${event} with data: ${JSON.stringify(data).slice(0, 100)}...`, { event });
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
      await log(`bot_lead attempting connection #${attempt + 1}/${maxRetries} to ${WEBSOCKET_URL}`);
      botSocket = io(WEBSOCKET_URL, {
        transports: ['websocket'],
        reconnection: false, // Use manual retries
        timeout: 60000,
        path: '/socket.io',
      });

      botSocket.on('connect', async () => {
        await log(`bot_lead linked to galactic hub with ID: ${botSocket.id}`);
        botSocket.emit('register', { name: 'bot_lead', role: 'lead' });
        resolve(botSocket);
      });

      botSocket.on('frontend_connected', async (data) => {
        try {
          const { frontendId, userName, ip, sessionId } = data;
          await log(`Frontend connected: ${JSON.stringify({ ip, frontendId, userName, sessionId })}`);
          const userKey = `user:${frontendId}`;
          const stateKey = `state:${frontendId}`;
          const existingUser = await redisClient.get(userKey);
          let parsedUser = null;
          if (existingUser) {
            try {
              parsedUser = JSON.parse(existingUser);
            } catch (err) {
              await redisClient.del(userKey);
              await log(`Cleared corrupted user data for ${frontendId}`);
            }
          }
          if (parsedUser && parsedUser.name) {
            const welcomeBackMsg = await generateResponse(
              `🌌 Welcome back, ${parsedUser.name}! Your cosmic journey continues—choose your path!`,
              parsedUser.name,
              'cosmic'
            );
            await sendMessage(botSocket, {
              text: welcomeBackMsg,
              type: 'success',
              taskId: `initial:${frontendId}`,
              ip,
              user: parsedUser.name,
              frontendId,
              options: ['Chat', 'Build-Something-Epic'],
              bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
              messageId: `${frontendId}-welcome-back`,
            });
            await redisClient.set(stateKey, JSON.stringify({ step: 'choice', taskId: `initial:${frontendId}` }));
          } else {
            const welcomeMsg = await generateResponse(
              `🌌 Galactic gates open, star voyager! Name yourself to claim your cosmic legacy!`,
              'Guest',
              'cosmic'
            );
            await sendMessage(botSocket, {
              text: welcomeMsg,
              type: 'question',
              taskId: `initial:${frontendId}`,
              ip,
              user: 'Guest',
              frontendId,
              options: ['Type your name below!'],
              bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
              messageId: `${frontendId}-welcome`,
            });
            await redisClient.set(stateKey, JSON.stringify({ step: 'name', taskId: `initial:${frontendId}` }));
          }
        } catch (err) {
          await error(`Failed to handle frontend_connected: ${err.message}`);
        }
      });

      botSocket.on('message', async (data) => {
        try {
          const { text, type, frontendId, ip, user, sessionId, taskId, commandFlag } = data;
          await log(`Received message: ${JSON.stringify({ text, type, frontendId, ip, user, sessionId, taskId })}`);
          const userKey = `user:${frontendId}`;
          const stateKey = `state:${frontendId}`;
          if (commandFlag) {
            const [command, ...args] = text.split(' ').filter(Boolean);
            await executeCommand(botSocket, {
              command: command.replace('/', ''),
              args: args.join(' '),
              frontendId,
              user,
              tone: 'cosmic',
              ip,
              taskId,
              userKey,
              stateKey,
            }, redisClient);
          } else if (type === 'task_response') {
            await handleTaskResponse(botSocket, { text, frontendId, ip, user, sessionId, taskId, userKey, stateKey }, redisClient);
          }
        } catch (err) {
          await error(`Failed to handle message: ${err.message}`);
        }
      });

      botSocket.on('connect_error', async (err) => {
        await error(`bot_lead connection failed: ${err.message}`);
        if (attempt < maxRetries - 1) {
          attempt++;
          const delay = 1000 * Math.pow(2, attempt);
          await log(`Retrying connection in ${delay}ms, attempt ${attempt + 1}/${maxRetries}`);
          setTimeout(connect, delay);
        } else {
          reject(new Error(`bot_lead failed to connect after ${maxRetries} attempts: ${err.message}`));
        }
      });

      botSocket.on('error', async (err) => {
        await error(`WebSocket error: ${err.message}`);
      });

      botSocket.on('heartbeat', async () => {
        await log(`bot_lead WebSocket heartbeat: radiating cosmic energy!`);
      });
    } catch (err) {
      await error(`Connection setup failed: ${err.message}`);
      if (attempt < maxRetries - 1) {
        attempt++;
        const delay = 1000 * Math.pow(2, attempt);
        await log(`Retrying connection in ${delay}ms, attempt ${attempt + 1}/${maxRetries}`);
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
    await log('🌌 bot_lead socket.js v2025-07-23-02 igniting...');
    await botSocketPromise;
    await log('🌌 bot_lead socket.js forged—ready to traverse the cosmic web!');
  } catch (err) {
    await error(`bot_lead socket.js supernova-failed: ${err.message}`);
    process.exit(1);
  }
})();