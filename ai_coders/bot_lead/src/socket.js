// ai_coders/bot_lead/src/socket.js
import io from 'socket.io-client';
import { log, error } from './logger.js';

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