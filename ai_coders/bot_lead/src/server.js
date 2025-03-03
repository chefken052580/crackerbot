import 'dotenv/config';
import { initializeWebSocket } from './websocketHandler.js';

console.log('Starting bot_lead...');
console.log('OPENAI_API_KEY at startup:', process.env.OPENAI_API_KEY || 'Not set');
initializeWebSocket();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});