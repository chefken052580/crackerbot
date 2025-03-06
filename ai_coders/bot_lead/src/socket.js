import { io } from 'socket.io-client';
import { log } from './logger.js';

const WEBSOCKET_SERVER_URL = "ws://websocket_server:5002";
const BACKEND_URL = "http://bot_backend:5000";

const botSocket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  transports: ['websocket'],
});

console.log('Initializing botSocket with URL:', WEBSOCKET_SERVER_URL);

botSocket.on('connect', async () => {
  console.log('Bot socket connected to server');
  await log(`Bot_lead connected to WebSocket server with ID: ${botSocket.id}`);
  botSocket.emit('register', { name: 'bot_lead', role: 'lead' });
  botSocket.emit('message', {
    text: "Cracker Bot online—ready to rock the matrix!",
    type: "system",
    from: 'Cracker Bot',
    target: 'bot_frontend',
  });
  await log(`Sent test connect message`);
});

botSocket.onAny((event, ...args) => {
  console.log(`[DEBUG] Bot_lead received event: ${event}, args: ${JSON.stringify(args)}`);
});

botSocket.on('frontend_connected', async (data) => {
    const frontendId = data.frontendId;
    const welcome = await generateResponse(
      `I’m Cracker Bot—a well-oiled set of engineer bots ready to program anything in the matrix. New connection detected! What’s your name, code warrior?`,
      "Guest",
      DEFAULT_TONE
    );
    botSocket.emit('message', {
      text: welcome,
      type: "question",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip: data.ip || 'unknown',
      taskId: `initial_name:${frontendId}:${Date.now()}`,
      user: 'Guest',
      frontendId,
    });
    await log(`Sent initial name prompt for frontendId ${frontendId}: ${welcome}`);
  });

botSocket.on('disconnect', (reason) => {
  console.log(`Bot socket disconnected: ${reason}`);
});

export { botSocket, BACKEND_URL };