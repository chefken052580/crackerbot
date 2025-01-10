import { WebSocket } from 'ws';

let wsClient;

function connectToWebSocket() {
  wsClient = new WebSocket('ws://websocket_server:5002'); // Use service name for Docker network

  wsClient.on('open', () => {
    console.log('Connected to WebSocket server');
    wsClient.send(JSON.stringify({ type: 'register', name: 'bot_lead', role: 'lead' }));
  });

  wsClient.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);
    // Handle messages here
  });

  wsClient.on('close', () => {
    console.log('Connection closed, attempting reconnect...');
    setTimeout(connectToWebSocket, 5000);
  });

  wsClient.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

connectToWebSocket();