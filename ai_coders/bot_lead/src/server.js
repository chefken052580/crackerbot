import 'dotenv/config';
import http from 'http';
import { initializeWebSocket } from './websocketHandler.js';
import { botSocket } from './socket.js';

const app = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('bot_lead is healthy!');
  }
});

console.log('Starting bot_lead...');
console.log('OPENAI_API_KEY at startup:', process.env.OPENAI_API_KEY || 'Not set');

(async () => {
  await botSocket; // Wait for socket initialization
  initializeWebSocket(app);
})();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});