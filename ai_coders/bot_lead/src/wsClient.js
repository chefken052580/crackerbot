import io from 'socket.io-client';

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

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      socket.emit('register', { name: 'bot_lead', role: 'lead' });
      retryCount = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log(`⚠️ WebSocket disconnected (${reason}). Retrying...`);
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
        console.log(`🔄 Reconnect attempt ${retryCount}/${maxRetries}, retrying in ${delay / 1000} seconds`);
      } else {
        console.error('❌ Max reconnection attempts reached.');
      }
    });

    socket.on('error', (err) => {
      console.error('❌ WebSocket error:', err);
    });
  }
  return socket;
}

export function getSocketInstance() {
  if (!socket) {
    console.log('Initializing WebSocket connection...');
    initializeSocket();
  }
  return socket;
}

// Auto-connect on module load
initializeSocket();