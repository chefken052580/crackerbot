// websocket_server/src/socket.js
// Version: v2025-07-28-02
/**
 * WebSocket Server for CrackerBot
 * Manages cosmic connections between bot_lead, bot_backend, and bot_frontend.
 * Enhanced by xAI for robust routing, logging, and connection stability.
 *
 * @version 2025-07-28-02
 * @author CrackerBot Team, enhanced by xAI
 */

import { Server } from 'socket.io';
import { log, error } from './logger.js';

const bots = new Map();
let botLeadSocketId = null;

/**
 * Initializes the WebSocket server with enhanced routing and logging.
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO instance
 */
export function initializeSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: [
        'https://visually-sterling-spider.ngrok-free.app',
        'http://localhost:*',
        'http://bot_frontend:80',
        'wss://visually-sterling-spider.ngrok-free.app',
      ],
      methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    pingInterval: 25000, // Reduced to balance heartbeat frequency
    pingTimeout: 60000, // Adjusted to allow sufficient client response time
    connectionStateRecovery: {
      maxDisconnectionDuration: 5 * 60 * 1000, // Increased to 5 minutes
      skipMiddlewares: true,
    },
  });

  console.log(`[${new Date().toISOString()}] Loaded socket.js with enhanced routing and logging`);

  io.on('connection', (socket) => {
    log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`, { socketId: socket.id });

    socket.on('register', (data) => {
      try {
        const { name, role, frontendId } = data || {};
        if (!name || !role) {
          error(`Invalid registration data: ${JSON.stringify(data)}`, { socketId: socket.id });
          socket.emit('error', { message: 'Invalid registration data' });
          return;
        }
        log(`📥 Received event from ${socket.id}: register, args: ${JSON.stringify(data)}, socket.connected: ${socket.connected}`, { socketId: socket.id });
        bots.set(socket.id, { name, role, socket, frontendId });
        if (role === 'lead') botLeadSocketId = socket.id;
        log(`✅ ${name} (${role}) registered with ID ${socket.id}${frontendId ? `, frontendId: ${frontendId}` : ''}`, { socketId: socket.id });
        log(`Current bots: ${Array.from(bots.values()).map((bot) => bot.name).join(',')}`, { socketId: socket.id });
        if (botLeadSocketId && role !== 'lead') {
          const leadSocket = bots.get(botLeadSocketId)?.socket;
          if (leadSocket) {
            leadSocket.emit('register', data);
            log(`📤 Sent register to bot_lead (${botLeadSocketId}) for ${name}`, { socketId: socket.id });
          }
        }
      } catch (err) {
        error(`Registration error: ${err.message}`, { socketId: socket.id });
        socket.emit('error', { message: `Registration failed: ${err.message}` });
      }
    });

    socket.on('frontend_connected', (data) => {
      try {
        log(`📩 Frontend connected: ${JSON.stringify(data)}`, { socketId: socket.id });
        if (botLeadSocketId) {
          const leadSocket = bots.get(botLeadSocketId)?.socket;
          if (leadSocket) {
            leadSocket.emit('frontend_connected', { ...data, ip: socket.handshake.address });
            log(`📤 Forwarded frontend_connected to bot_lead (${botLeadSocketId})`, { socketId: socket.id });
          }
        }
      } catch (err) {
        error(`Frontend connected error: ${err.message}`, { socketId: socket.id });
      }
    });

    socket.on('message', (data, callback) => {
      try {
        const message = Array.isArray(data) ? data[0] : data;
        log(`📩 Raw message data: ${JSON.stringify(message)}`, { socketId: socket.id });
        log(`📩 commandFlag value: ${message.commandFlag}, type: ${message.type}`, { socketId: socket.id });
        log(`📩 Message received from ${bots.get(socket.id)?.name || 'unknown'}: ${JSON.stringify(message)}`, { socketId: socket.id });
        const { target, frontendId } = message;
        if (target === 'bot_frontend' && frontendId) {
          const frontendSocket = Array.from(bots.values()).find((bot) => bot.frontendId === frontendId && bot.role === 'frontend')?.socket;
          if (frontendSocket) {
            frontendSocket.emit('message', message);
            log(`📤 Sent message directly to frontendId ${frontendId} (socket ${frontendSocket.id})`, { socketId: socket.id });
            if (callback) callback({ status: 'sent' });
          } else {
            log(`📤 Sent message to room ${frontendId} (broadcast)`, { socketId: socket.id });
            io.to(frontendId).emit('message', message);
            if (callback) callback({ status: 'broadcast' });
          }
        } else if (target) {
          const targetSocket = Array.from(bots.values()).find((bot) => bot.name === target)?.socket;
          if (targetSocket) {
            targetSocket.emit('message', message);
            log(`📤 Sent message to ${target} (socket ${targetSocket.id})`, { socketId: socket.id });
            if (callback) callback({ status: 'sent' });
          } else {
            error(`Target ${target} not found`, { socketId: socket.id });
            if (callback) callback({ status: 'error', message: `Target ${target} not found` });
          }
        } else if (botLeadSocketId) {
          const leadSocket = bots.get(botLeadSocketId)?.socket;
          if (leadSocket) {
            leadSocket.emit(message.commandFlag ? 'command' : message.type || 'message', message);
            log(`📤 Sent ${message.commandFlag ? 'command' : message.type || 'message'} to bot_lead (${botLeadSocketId})`, { socketId: socket.id });
            if (callback) callback({ status: 'sent' });
          }
        }
      } catch (err) {
        error(`Message processing error: ${err.message}`, { socketId: socket.id });
        if (callback) callback({ status: 'error', message: err.message });
      }
    });

    socket.on('typing', (data) => {
      try {
        const { frontendId } = data;
        if (frontendId) {
          log(`📥 Received typing event: ${JSON.stringify(data)}`, { socketId: socket.id });
          const frontendSocket = Array.from(bots.values()).find((bot) => bot.frontendId === frontendId && bot.role === 'frontend')?.socket;
          if (frontendSocket) {
            frontendSocket.emit('typing', data);
            log(`📤 Forwarded typing to frontendId ${frontendId} (socket ${frontendSocket.id})`, { socketId: socket.id });
          } else {
            io.to(frontendId).emit('typing', data);
            log(`📤 Broadcast typing to room ${frontendId}`, { socketId: socket.id });
          }
        }
      } catch (err) {
        error(`Typing event error: ${err.message}`, { socketId: socket.id });
      }
    });

    socket.on('heartbeat', (data) => {
      try {
        log(`💓 Heartbeat received from ${bots.get(socket.id)?.name || 'unknown'}: ${JSON.stringify(data)}`, { socketId: socket.id });
        socket.emit('heartbeat', { status: 'alive', timestamp: new Date().toISOString() });
      } catch (err) {
        error(`Heartbeat error: ${err.message}`, { socketId: socket.id });
      }
    });

    socket.on('disconnect', (reason) => {
      const bot = bots.get(socket.id);
      if (bot) {
        log(`❌ ${bot.name} disconnected. Remaining bots: ${Array.from(bots.values()).filter((b) => b.socket.id !== socket.id).map((b) => b.name)}`, { socketId: socket.id });
        bots.delete(socket.id);
        if (socket.id === botLeadSocketId) botLeadSocketId = null;
      }
      log(`🔌 Client ${socket.id} disconnected: ${reason}`, { socketId: socket.id });
    });
  });

  console.log(`[${new Date().toISOString()}] ✅ WebSocket server initialized on /socket.io`);
  return io;
}