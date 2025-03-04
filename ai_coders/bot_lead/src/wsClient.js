import io from 'socket.io-client';
import { log } from './logger.js';
import { redisClient } from './taskManager.js'; // Import redisClient to check user name

const WEBSOCKET_SERVER_URL = 'ws://websocket_server:5002';
const maxRetries = 50;
const maxDelay = 60000;

let socket = null;
let retryCount = 0;

function initializeSocket() {
  if (!socket || socket.disconnected) {
    socket = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: maxRetries,
      reconnectionDelay: 1000,
      reconnectionDelayMax: maxDelay,
      transports: ['websocket'],
    });

    socket.on('connect', async () => {
      await log('✅ Connected to WebSocket server');
      socket.emit('register', { name: 'bot_lead', role: 'lead' });
      retryCount = 0;
    });

    socket.on('frontend_connected', async (data) => {
      const userId = data.frontendId;
      const userKey = `user:${userId}:name`;
      const existingName = await redisClient.get(userKey);
      
      if (!existingName) {
        const greetingMessage = {
          text: "Hey there, I’m Cracker Bot—your witty wingman! What’s your name, chief?",
          type: "question",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          userId,
        };
        await log('Sending initial greeting to bot_frontend: ' + JSON.stringify(greetingMessage));
        socket.emit('message', greetingMessage);
      } else {
        await log(`User ${existingName} already registered for ID ${userId}, skipping greeting`);
      }
    });

    socket.on('disconnect', async (reason) => {
      await log(`⚠️ WebSocket disconnected (${reason}). Retrying...`);
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
        await log(`🔄 Reconnect attempt ${retryCount}/${maxRetries}, retrying in ${delay / 1000} seconds`);
      } else {
        await error('❌ Max reconnection attempts reached.');
      }
    });

    socket.on('error', async (err) => {
      await error('❌ WebSocket error: ' + err.message);
    });
  }
  return socket;
}

export const botSocket = initializeSocket();
export function getSocketInstance() {
  return botSocket;
}