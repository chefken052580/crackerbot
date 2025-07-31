// websocket_server/src/server.js
// Version: v2025-07-23-01
import { createServer } from 'http';
import { log, error } from './logger.js';
import { initializeSocket } from './socket.js'; // Use named import

const PORT = process.env.PORT || 5002;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

const httpServer = createServer();

initializeSocket(httpServer); // Initialize with named export

// Health check endpoint
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('websocket_server is healthy');
  }
});

httpServer.listen(PORT, () => {
  log(`WebSocket server running on port ${PORT}`, { corsOrigin: CORS_ORIGIN });
});

httpServer.on('error', (err) => {
  error('Server error', { error: err.message });
});