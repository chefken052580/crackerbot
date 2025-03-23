// ai_coders/bot_lead/src/index.js
const express = require('express');
const app = express();
const router = express.Router();
const { Server } = require('socket.io');
const http = require('http');
const commandRoutes = require('./commands');
const { generateResponse } = require('./aiHelper');
const { registerTaskResultListener } = require('./taskHandlers');
const { log } = require('./logger');

// WebSocket server setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';
const botSocket = require('socket.io-client')(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

// Middleware
app.use(express.json());
app.use('/api', router);

// Express Routes
router.get('/', (req, res) => {
  res.send("Bot Lead is running.");
});

router.use('/commands', commandRoutes);

router.post('/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message text is required." });
  }

  try {
    console.log(`AI request received: ${message}`);
    const response = await generateResponse(message);
    console.log(`AI response: ${response}`);
    res.json({ response });
  } catch (error) {
    console.error("AI processing error:", error);
    res.status(500).json({ error: "AI service failed." });
  }
});

// WebSocket Setup
botSocket.on('connect', async () => {
  console.log(`[${new Date().toISOString()}] bot_lead connected to WebSocket server at ${WEBSOCKET_SERVER_URL}`);
  await log(`bot_lead connected to WebSocket server with ID: ${botSocket.id}`);
  botSocket.emit('register', { name: 'bot_lead', role: 'lead', userId: botSocket.id });
  await log('bot_lead emitted register event');
});

botSocket.on('disconnect', () => {
  console.log(`[${new Date().toISOString()}] bot_lead disconnected from WebSocket server`);
});

// Register the taskResult listener
registerTaskResultListener(botSocket);

// Start Server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Bot Lead running on port ${PORT}`);
});

module.exports = router;