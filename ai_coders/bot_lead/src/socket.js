import io from 'socket.io-client';
import { log, error } from './logger.js';
import config from './config.js';

const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_URL || `ws://${config.server.host}:${config.server.websocketPort}`;
const BACKEND_URL = process.env.BACKEND_URL || 'http://bot_backend:5000';
const maxRetries = 50;
const maxDelay = 60000;

let botSocket = null;

function initializeSocket() {
  if (!botSocket) {
    console.log(`Initializing botSocket with URL: ${WEBSOCKET_SERVER_URL}`); // Synchronous log for startup
    botSocket = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: maxRetries,
      reconnectionDelay: 1000,
      reconnectionDelayMax: maxDelay,
      transports: ['websocket'],
    });

    botSocket.on('connect', async () => {
      await log('✅ Connected to WebSocket server');
      botSocket.emit('register', { name: 'bot_lead', role: 'lead' });
    });

    botSocket.on('connect_error', async (err) => {
      await error(`❌ WebSocket connection error: ${err.message}`);
    });

    botSocket.on('reconnect_attempt', async (attempt) => {
      await log(`🔄 Reconnect attempt ${attempt}/${maxRetries}`);
    });

    botSocket.on('disconnect', async (reason) => {
      await log(`⚠️ WebSocket disconnected (${reason}). Retrying...`);
    });

    botSocket.on('error', async (err) => {
      await error(`❌ WebSocket error: ${err.message}`);
    });
  }
  return botSocket;
}

// Initialize immediately
initializeSocket();

export { botSocket, BACKEND_URL };