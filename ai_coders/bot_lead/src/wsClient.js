import io from 'socket.io-client';

const WEBSOCKET_SERVER_URL = 'http://websocket_server:5002';
const maxRetries = 50;
const maxDelay = 60000;

let socket;
let retryCount = 0;

export function connectToWebSocket() {
  socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay
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
      let delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
      console.log(`🔄 Reconnect attempt ${retryCount}, retrying in ${delay / 1000} seconds`);
      setTimeout(connectToWebSocket, delay);
    } else {
      console.error('❌ Max reconnection attempts reached.');
    }
  });
}

export function getSocketInstance() {
  return socket;
}

// Auto-connect
connectToWebSocket();
