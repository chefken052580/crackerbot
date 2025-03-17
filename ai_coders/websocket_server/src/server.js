import 'dotenv/config';
import express from 'express';
import http from 'http';
import WebSocketHandler from './socket.js';  // Import our custom WebSocket handler

const PORT = process.env.PORT || 5002;

const app = express();
const httpServer = http.createServer(app);

// Initialize WebSocket handling with socket.js
new WebSocketHandler(httpServer);

app.get('/health', (req, res) => {
  res.status(200).send('WebSocket server is healthy');
});

httpServer.listen(PORT, () => {
  console.log(`✅ HTTP and WebSocket server running on port ${PORT}`);
});