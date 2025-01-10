import io from 'socket.io-client';

let socket;
let retryCount = 0;
const maxRetries = 50; // Example: limit retries to 50 attempts
const maxDelay = 60000; // 1 minute max delay

function connectToWebSocket() {
  socket = io('http://websocket_server:5002', {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    socket.emit('register', { name: 'bot_backend', role: 'backend' });
    retryCount = 0;
  });

  socket.on('message', (data) => {
    console.log('Received message:', data);
    // Handle messages here, e.g., process commands or update tasks
  });

  socket.on('disconnect', (reason) => {
    console.log(`WebSocket connection closed, reason: ${reason}, attempting reconnect...`);
    if (retryCount < maxRetries) {
      retryCount++;
      let delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
      console.log(`Retry attempt ${retryCount}, will retry in ${delay / 1000} seconds`);
    } else {
      console.log('Max reconnection attempts reached. Stopping reconnection attempts.');
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

connectToWebSocket();