// websocket_server/routes/index.js
// Version: v2025-07-22-13
/**
 * WebSocket Server Routes
 * Manages cosmic connections for CrackerBot, routing messages between frontend, bot_lead, and bot_backend.
 * Enhanced by xAI for robust message handling and logging.
 *
 * @version 2025-07-22-13
 * @author CrackerBot Team, enhanced by xAI
 * @module routes
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { createClient } from 'redis';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || 'https://visually-sterling-spider.ngrok-free.app', credentials: true },
});

const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.on('error', (err) => console.error(`Redis error: ${err.message}`));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Redis connected for WebSocket server');
  } catch (err) {
    console.error(`Redis connection failed: ${err.message}`);
  }
}
connectRedis();

const bots = new Map();
const frontendSockets = new Map();

app.get('/health', (req, res) => {
  res.status(200).send('WebSocket server is radiating cosmic vibes!');
});

io.on('connection', (socket) => {
  console.log(`🔗 [${new Date().toISOString()}] New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

  socket.on('register', async (data) => {
    const { name, role, frontendId } = data;
    console.log(`📥 [${new Date().toISOString()}] Received event from ${socket.id}: register, args: ${JSON.stringify(data)}, socket.connected: ${socket.connected}`);

    if (!name || !role) {
      console.error(`❌ [${new Date().toISOString()}] Invalid registration data: ${JSON.stringify(data)}`);
      return;
    }

    if (role === 'frontend') {
      if (!frontendId) {
        console.error(`❌ [${new Date().toISOString()}] Missing frontendId for frontend registration`);
        return;
      }
      frontendSockets.set(frontendId, socket.id);
    } else {
      bots.set(name, { socketId: socket.id, role });
    }

    console.log(`✅ [${new Date().toISOString()}] ${name} (${role}) registered with ID ${socket.id}`);
    console.log(`Current bots: ${Array.from(bots.keys()).join(',')}`);

    if (role !== 'frontend') {
      const botLead = bots.get('bot_lead');
      if (botLead) {
        io.to(botLead.socketId).emit('register', data);
        console.log(`📤 [${new Date().toISOString()}] Sent register to bot_lead (${botLead.socketId}) for ${name}`);
      }
    }
  });

  socket.on('frontend_connected', async (data) => {
    console.log(`📩 [${new Date().toISOString()}] Frontend connected: ${JSON.stringify(data)}`);
    const botLead = bots.get('bot_lead');
    if (botLead) {
      io.to(botLead.socketId).emit('frontend_connected', data);
      console.log(`📤 [${new Date().toISOString()}] Forwarded frontend_connected to bot_lead (${botLead.socketId})`);
    } else {
      console.log(`📥 [${new Date().toISOString()}] Queued frontend_connected for bot_lead`);
      await redisClient.lPush('frontend_connected_queue', JSON.stringify(data));
    }
  });

  socket.on('message', async (data) => {
    const message = Array.isArray(data) && data.length > 0 ? data[0] : data;
    console.log(`📩 [${new Date().toISOString()}] Raw message data: ${JSON.stringify(message)}`);
    console.log(`📩 [${new Date().toISOString()}] commandFlag value: ${message.commandFlag}, type: ${message.type}`);

    if (!message.target) {
      console.error(`❌ [${new Date().toISOString()}] No target specified in message: ${JSON.stringify(message)}`);
      return;
    }

    console.log(`📩 [${new Date().toISOString()}] Message received from ${message.from || socket.id}: ${JSON.stringify(message)}`);

    if (message.target === 'bot_frontend' && message.frontendId) {
      const frontendSocketId = frontendSockets.get(message.frontendId);
      if (frontendSocketId) {
        io.to(frontendSocketId).emit('message', message);
        console.log(`📤 [${new Date().toISOString()}] Sent message directly to frontendId ${message.frontendId} (socket ${frontendSocketId})`);
      } else {
        console.error(`❌ [${new Date().toISOString()}] Frontend socket not found for ${message.frontendId}`);
      }
    } else if (message.target === 'bot_lead') {
      const botLead = bots.get('bot_lead');
      if (botLead) {
        io.to(botLead.socketId).emit('message', message);
        console.log(`📤 [${new Date().toISOString()}] Sent message to bot_lead (${botLead.socketId}) via target`);
      } else {
        console.error(`❌ [${new Date().toISOString()}] bot_lead not found for message: ${JSON.stringify(message)}`);
      }
    } else if (message.target === 'bot_backend') {
      const botBackend = bots.get('bot_backend');
      if (botBackend) {
        io.to(botBackend.socketId).emit('message', message);
        console.log(`📤 [${new Date().toISOString()}] Sent message to bot_backend (${botBackend.socketId}) via target`);
      } else {
        console.error(`❌ [${new Date().toISOString()}] bot_backend not found for message: ${JSON.stringify(message)}`);
      }
    }
  });

  socket.on('command', async (data) => {
    const { command, args, target, frontendId } = data;
    console.log(`📥 [${new Date().toISOString()}] Received command from ${socket.id}: ${command}, args: ${JSON.stringify(args)}, target: ${target}`);

    if (target === 'bot_lead') {
      const botLead = bots.get('bot_lead');
      if (botLead) {
        io.to(botLead.socketId).emit('command', data);
        console.log(`📤 [${new Date().toISOString()}] Forwarded command ${command} to bot_lead (${botLead.socketId})`);
      } else {
        console.log(`📥 [${new Date().toISOString()}] Queued command ${command} for bot_lead`);
        await redisClient.lPush('command_queue', JSON.stringify(data));
      }
    } else if (target === 'bot_backend') {
      const botBackend = bots.get('bot_backend');
      if (botBackend) {
        io.to(botBackend.socketId).emit('command', data);
        console.log(`📤 [${new Date().toISOString()}] Forwarded command ${command} to bot_backend (${botBackend.socketId})`);
      } else {
        console.log(`📥 [${new Date().toISOString()}] Queued command ${command} for bot_backend`);
        await redisClient.lPush('command_queue', JSON.stringify(data));
      }
    }
  });

  socket.on('heartbeat', (data) => {
    console.log(`📥 [${new Date().toISOString()}] Received event from ${socket.id}: heartbeat, args: ${JSON.stringify(data)}, socket.connected: ${socket.connected}`);
  });

  socket.on('disconnect', () => {
    let disconnectedBot = null;
    for (const [name, bot] of bots.entries()) {
      if (bot.socketId === socket.id) {
        disconnectedBot = name;
        bots.delete(name);
        break;
      }
    }
    for (const [frontendId, socketId] of frontendSockets.entries()) {
      if (socketId === socket.id) {
        frontendSockets.delete(frontendId);
        disconnectedBot = 'frontend';
        break;
      }
    }
    if (disconnectedBot) {
      console.log(`❌ [${new Date().toISOString()}] ${disconnectedBot} disconnected. Remaining bots: [ ${Array.from(bots.keys()).join(', ')} ]`);
    }
    console.log(`🔌 [${new Date().toISOString()}] Client ${socket.id} disconnected: ${socket.conn.closeReason || 'unknown reason'}`);
  });
});

server.listen(5002, '0.0.0.0', () => {
  console.log(`✅ HTTP and WebSocket server running on port 5002`);
});
