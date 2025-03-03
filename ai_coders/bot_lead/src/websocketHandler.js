import { io } from 'socket.io-client';
import { handleMessage } from './taskManager.js';

const WEBSOCKET_SERVER_URL = 'wss://websocket-visually-sterling-spider.ngrok-free.app';

export function initializeWebSocket() {
  const botSocket = io(WEBSOCKET_SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  botSocket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
    botSocket.emit('register', { name: 'bot_lead', role: 'lead' });
  });

  botSocket.on('bot_registered', (data) => {
    if (data.name === 'bot_frontend') {
      console.log('Frontend registered, sending intro');
      botSocket.emit('message', {
        text: "Hey there, I’m Cracker Bot—your witty wingman for all things creative! I’m here to whip up genius faster than you can say 'bad pun.' What’s your name, chief?",
        type: "question",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        userId: botSocket.id
      });
    }
  });

  botSocket.on('message', (data) => handleMessage(botSocket, data));
  botSocket.on('command', (data) => handleMessage(botSocket, data));
  botSocket.on('taskResponse', (data) => handleMessage(botSocket, { ...data, type: 'task_response' }));

  return botSocket;
}