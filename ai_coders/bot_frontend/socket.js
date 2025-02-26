import { io } from 'socket.io-client';

const WEBSOCKET_SERVER_URL = 'ws://3.tcp.ngrok.io:29469'; // Paid TCP tunnel

console.log('Attempting to connect to WebSocket at:', WEBSOCKET_SERVER_URL);

function connectSocket() {
  const socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log('Bot Frontend successfully connected to WebSocket!');
    console.log('Socket ID:', socket.id);
    socket.emit('register', { name: 'bot_frontend', role: 'frontend' });
    console.log('Registration sent to WebSocket server.');
  });

  socket.on('message', (message) => console.log('Message received by Bot Frontend:', message));
  socket.on('commandResponse', (response) => console.log('Command response received by Bot Frontend:', response));
  socket.on('connect_error', (error) => console.error('WebSocket connect error in Bot Frontend:', error));
  socket.on('connect_timeout', () => console.error('WebSocket connection timeout in Bot Frontend'));
  socket.on('reconnect_attempt', (attemptNumber) => console.log(`WebSocket reconnection attempt ${attemptNumber}`));
  socket.on('reconnect_error', (error) => console.error('WebSocket reconnection error:', error));
  socket.on('reconnect_failed', () => console.error('WebSocket reconnection failed after multiple attempts.'));
  socket.on('disconnect', (reason) => {
    console.log('Bot Frontend WebSocket disconnected. Reason:', reason);
    console.log('Attempting to reconnect...');
  });

  return socket;
}

export default connectSocket;