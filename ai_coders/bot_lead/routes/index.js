// ai_coders/bot_lead/src/routes/index.js (CommonJS, v2025-03-28-2)
/**
 * Bot Lead Server Setup
 * Initializes Express server and WebSocket client for CrackerBot’s cosmic lead bot,
 * with heartbeat to signal its interstellar presence.
 *
 * @version 2025-03-28-2
 * @author CrackerBot Team, enhanced by xAI
 */

const express = require('express');
const app = express();
const router = express.Router();
const http = require('http');
const commandRoutes = require('./commands');
const { generateResponse } = require('../aiHelper');
const { log } = require('../logger');
const { initializeTaskListeners } = require('../taskHandlers');

const server = http.createServer(app);

const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';
const botSocket = require('socket.io-client')(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

app.use(express.json());
app.use('/api', router);

router.get('/', (req, res) => {
  res.send('Bot Lead is running—cosmic channels open! 🌌');
});

router.use('/commands', commandRoutes);

router.post('/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    console.log(`AI request received: ${message}`);
    const response = await generateResponse(message);
    console.log(`AI response: ${response}`);
    res.json({ response });
  } catch (error) {
    console.error('AI processing error:', error);
    res.status(500).json({ error: 'AI service failed.' });
  }
});

// WebSocket event handlers
botSocket.on('connect', async () => {
  console.log(`[${new Date().toISOString()}] bot_lead connected to WebSocket server at ${WEBSOCKET_SERVER_URL}`);
  await log(`bot_lead connected to WebSocket server with ID: ${botSocket.id}`);
  botSocket.emit('register', { name: 'bot_lead', role: 'lead', userId: botSocket.id });
  await log('bot_lead emitted register event—cosmic handshake complete!');
});

botSocket.on('disconnect', async () => {
  console.log(`[${new Date().toISOString()}] bot_lead disconnected from WebSocket server`);
  await log('bot_lead disconnected—cosmic signal lost! ⚠️');
});

// Heartbeat to signal bot_lead is alive
setInterval(async () => {
  if (botSocket.connected) {
    await log('bot_lead WebSocket heartbeat: pulsing through the cosmos! 🌌');
  } else {
    await log('bot_lead WebSocket heartbeat: signal faint—reconnecting... ⚠️');
  }
}, 10000); // Every 10 seconds

// Initialize task listeners for cosmic event handling
initializeTaskListeners(botSocket);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Bot Lead running on port ${PORT}—ready to lead the cosmic charge! 🚀`);
});

module.exports = router;