import io from 'socket.io-client';

let socket;
let retryCount = 0;
const maxRetries = Infinity; // Changed to Infinity for continuous attempts
const maxDelay = 60000; // 1 minute max delay

function connectToWebSocket() {
  socket = io('http://websocket_server:5002', {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay,
    transports: ['websocket'], // Ensure only WebSocket transport is used
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    socket.emit('register', { name: 'bot_backend', role: 'backend' });
    retryCount = 0;
  });

  socket.on('message', (data) => {
    console.log('Received message:', data);
    // Handle messages here, e.g., process commands or update tasks
    if (data.type === 'command') {
      console.log("Command received:", data.command);
      // Example command handling:
      if (data.command === "some_backend_command") {
        // Process command
        socket.emit('response', { type: "response", user: 'bot_backend', text: "Command processed" });
      }
    } else if (data.type === 'message') {
      console.log("General message received:", data.text);
      // Handle general messages if needed
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`WebSocket connection closed, reason: ${reason}, attempting reconnect...`);
    retryCount++;
    let delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
    console.log(`Retry attempt ${retryCount}, will retry in ${delay / 1000} seconds`);
    setTimeout(connectToWebSocket, delay);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

connectToWebSocket();