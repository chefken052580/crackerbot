import { Server } from 'socket.io';

console.log(`[${new Date().toISOString()}] Loaded socket.js with commandFlag handling`);

class WebSocketHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      pingInterval: 25000,
      pingTimeout: 60000,
      cors: {
        origin: [
          process.env.CORS_ORIGIN || "https://visually-sterling-spider.ngrok-free.app",
          "http://localhost:*",
          "http://bot_frontend:80",
          "wss://websocket-visually-sterling-spider.ngrok-free.app",
        ],
        methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
        credentials: true,
      },
      path: '/socket.io',
    });
    this.bots = new Map();
    this.pendingEvents = [];
    console.log(`[${new Date().toISOString()}] WebSocket server initialized on ${this.io.path()}`);
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`🔗 [${new Date().toISOString()}] New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

      socket.onAny((event, ...args) => {
        console.log(`📥 [${new Date().toISOString()}] Received event from ${socket.id}: ${event}, args: ${JSON.stringify(args)}, socket.connected: ${socket.connected}`);
      });

      socket.on('register', (data) => {
        try {
          if (!data || !data.name || !data.role) {
            console.error(`❌ [${new Date().toISOString()}] Registration failed: Missing name or role:`, data);
            socket.emit("register_failed", "Missing name or role");
            return;
          }
          const botData = { name: data.name, role: data.role, socketId: socket.id, socket };
          this.bots.set(data.name, botData);
          socket.clientName = data.name;
          console.log(`✅ [${new Date().toISOString()}] ${data.name} (${data.role}) registered with ID ${socket.id}`);
          console.log(`Current bots: ${Array.from(this.bots.keys())}`);
          socket.emit("register_success");

          const leadBot = this.bots.get('bot_lead');
          if (leadBot && data.role !== 'lead') {
            leadBot.socket.emit('register', { ...data, ip: socket.handshake.address });
            console.log(`📤 [${new Date().toISOString()}] Sent register to bot_lead (${leadBot.socketId}) for ${data.name}`);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in register:`, error.message);
          socket.emit("error", { message: `Registration error: ${error.message}` });
        }
      });

      socket.on('frontend_connected', (data) => {
        try {
          const eventData = { ...data, frontendId: socket.id, ip: socket.handshake.address };
          console.log(`📩 [${new Date().toISOString()}] Frontend connected: ${JSON.stringify(eventData)}`);
          const leadBot = this.bots.get('bot_lead');
          if (leadBot) {
            leadBot.socket.emit('frontend_connected', eventData);
            console.log(`📤 [${new Date().toISOString()}] Forwarded frontend_connected to bot_lead (${leadBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'frontend_connected', eventData, target: 'bot_lead' });
            console.log(`📥 [${new Date().toISOString()}] Queued frontend_connected for bot_lead`);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in frontend_connected:`, error.message);
        }
      });

      socket.on('reset_user', (data) => {
        try {
          const eventData = { ...data, frontendId: socket.id, ip: socket.handshake.address };
          console.log(`🔄 [${new Date().toISOString()}] Reset_user from ${socket.id}: ${JSON.stringify(eventData)}`);
          const leadBot = this.bots.get('bot_lead');
          if (leadBot) {
            leadBot.socket.emit('reset_user', eventData);
            console.log(`📤 [${new Date().toISOString()}] Forwarded reset_user to bot_lead (${leadBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'reset_user', eventData, target: 'bot_lead' });
            console.warn(`⚠️ [${new Date().toISOString()}] Queued reset_user for bot_lead`);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in reset_user:`, error.message);
        }
      });

      socket.on('message', (data, callback) => {
        try {
          console.log(`📩 [${new Date().toISOString()}] Raw message data:`, data);
          console.log(`📩 [${new Date().toISOString()}] commandFlag value: ${data.commandFlag}, type: ${typeof data.commandFlag}`);
          if (!data || typeof data !== 'object') throw new Error("Invalid message format");
          console.log(`📩 [${new Date().toISOString()}] Message received: ${JSON.stringify(data)}`);

          const eventData = { ...data, ip: socket.handshake.address };

          // Handle commands disguised as messages
          if (data.commandFlag) {
            console.log(`🚀 [${new Date().toISOString()}] Command received as message from ${socket.clientName || socket.id}: ${JSON.stringify(data)}`);
            const targetBot = this.bots.get(data.target);
            if (targetBot) {
              targetBot.socket.emit('command', eventData);
              console.log(`📤 [${new Date().toISOString()}] Sent command to ${targetBot.name} (${targetBot.socketId})`);
              if (callback) callback({ status: "success", message: "Command routed" });
            } else {
              this.pendingEvents.push({ event: 'command', eventData, target: data.target });
              console.warn(`⚠️ [${new Date().toISOString()}] Queued command for ${data.target} - target not found`);
              if (callback) callback({ status: "queued", message: "Command queued, target not found" });
            }
          } else {
            // Regular message handling
            const senderRole = this.bots.get(socket.clientName)?.role;
            if (data.type === 'task_response' && senderRole === 'frontend') {
              // Route frontend task responses to bot_lead
              const leadBot = this.bots.get('bot_lead');
              if (leadBot) {
                leadBot.socket.emit('message', eventData);
                console.log(`📤 [${new Date().toISOString()}] Sent task_response to bot_lead (${leadBot.socketId})`);
              } else {
                console.warn(`⚠️ [${new Date().toISOString()}] No bot_lead found for task_response from ${socket.clientName || socket.id}`);
              }
            } else if (data.frontendId) {
              this.io.to(data.frontendId).emit('message', eventData);
              console.log(`📤 [${new Date().toISOString()}] Sent message to frontendId ${data.frontendId}`);
            } else {
              const targetBot = this.bots.get(data.target || 'bot_lead');
              if (targetBot) {
                targetBot.socket.emit('message', eventData);
                console.log(`📤 [${new Date().toISOString()}] Sent message to ${targetBot.name} (${targetBot.socketId})`);
              } else {
                console.warn(`⚠️ [${new Date().toISOString()}] Unhandled message from ${socket.clientName || socket.id}: ${JSON.stringify(data)}`);
                socket.emit('message', { text: "Error: Message target unclear", type: "error", from: "Server" });
              }
            }
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in message handler:`, error.message);
          socket.emit("error", { message: `Message error: ${error.message}` });
          if (callback) callback({ status: "error", message: error.message });
        }
      });

      socket.on('test', (data, callback) => {
        console.log(`📥 [${new Date().toISOString()}] Test event received from ${socket.id}: ${JSON.stringify(data)}`);
        socket.emit('test_response', { text: "Test acknowledged", from: "websocket_server" });
        if (callback) callback({ status: "success", message: "Test received" });
      });

      socket.on('command', (data, callback) => {
        try {
          if (!data || !data.target || !data.command) throw new Error("Missing target or command");
          console.log(`🚀 [${new Date().toISOString()}] Command received from ${socket.clientName || socket.id}: ${JSON.stringify(data)}`);
          console.log(`Current registered bots: ${Array.from(this.bots.keys())}`);
          const targetBot = this.bots.get(data.target);
          const eventData = { ...data, ip: socket.handshake.address, fromSocketId: socket.id };
          if (targetBot) {
            targetBot.socket.emit('command', eventData);
            console.log(`📤 [${new Date().toISOString()}] Sent command to ${targetBot.name} (${targetBot.socketId})`);
            socket.emit('message', { text: "Command received and routed", from: "websocket_server" });
            if (callback) callback({ status: "success", message: "Command routed" });
          } else {
            this.pendingEvents.push({ event: 'command', eventData, target: data.target });
            console.warn(`⚠️ [${new Date().toISOString()}] Queued command for ${data.target} - target not found`);
            this.io.emit('command', eventData);
            console.log(`📤 [${new Date().toISOString()}] Broadcast command as fallback: ${JSON.stringify(eventData)}`);
            if (callback) callback({ status: "queued", message: "Command queued, target not found" });
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in command handler:`, error.message);
          socket.emit("error", { message: `Command error: ${error.message}` });
          if (callback) callback({ status: "error", message: error.message });
        }
      });

      socket.on('broadcast_command', (data) => {
        console.log(`📡 [${new Date().toISOString()}] Broadcast command received from ${socket.clientName || socket.id}: ${JSON.stringify(data)}`);
        const targetBot = this.bots.get(data.target);
        const eventData = { ...data, ip: socket.handshake.address, fromSocketId: socket.id };
        if (targetBot) {
          targetBot.socket.emit('command', eventData);
          console.log(`📤 [${new Date().toISOString()}] Forwarded broadcast command to ${targetBot.name} (${targetBot.socketId})`);
        } else {
          console.warn(`⚠️ [${new Date().toISOString()}] No target found for broadcast command: ${data.target}`);
          this.io.emit('command', eventData);
          console.log(`📤 [${new Date().toISOString()}] Broadcast command to all as last resort: ${JSON.stringify(eventData)}`);
        }
      });

      socket.on('taskResult', (data) => {
        try {
          console.log(`📩 [${new Date().toISOString()}] TaskResult received from ${socket.id}: ${JSON.stringify(data)}`);
          const { leadId, frontendId } = data; // Extract leadId and frontendId from the payload
          const eventData = { ...data, ip: socket.handshake.address };

          // Route to bot_lead if leadId is provided
          if (leadId) {
            const leadSocket = this.io.sockets.sockets.get(leadId);
            if (leadSocket) {
              leadSocket.emit('taskResult', eventData);
              console.log(`📤 [${new Date().toISOString()}] Sent taskResult to bot_lead (${leadId})`);
            } else {
              console.warn(`⚠️ [${new Date().toISOString()}] bot_lead socket not found for leadId: ${leadId}`);
            }
          } else {
            console.warn(`⚠️ [${new Date().toISOString()}] No leadId specified in taskResult from ${socket.id}`);
          }

          // Optionally route to frontend if frontendId is provided
          if (frontendId) {
            const frontendSocket = this.io.sockets.sockets.get(frontendId);
            if (frontendSocket) {
              frontendSocket.emit('taskResult', eventData);
              console.log(`📤 [${new Date().toISOString()}] Sent taskResult to frontend (${frontendId})`);
            } else {
              this.io.to(frontendId).emit('taskResult', eventData);
              console.log(`📤 [${new Date().toISOString()}] Sent taskResult to room ${frontendId}`);
            }
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in taskResult handler:`, error.message);
        }
      });

      socket.on('taskResponse', (data) => {
        try {
          if (!data.target) throw new Error("Missing target");
          console.log(`📩 [${new Date().toISOString()}] TaskResponse: ${JSON.stringify(data)}`);
          const targetBot = this.bots.get(data.target || 'bot_lead');
          const eventData = { ...data, ip: socket.handshake.address };
          if (targetBot) {
            targetBot.socket.emit('taskResponse', eventData);
            console.log(`📤 [${new Date().toISOString()}] Sent taskResponse to ${targetBot.name} (${targetBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'taskResponse', eventData, target: data.target || 'bot_lead' });
            console.warn(`⚠️ [${new Date().toISOString()}] Queued taskResponse for ${data.target || 'bot_lead'}`);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in taskResponse:`, error.message);
        }
      });

      socket.on('commandResponse', (data) => {
        try {
          if (!data.target) throw new Error("Missing target");
          console.log(`✅ [${new Date().toISOString()}] CommandResponse: ${JSON.stringify(data)}`);
          const targetBot = this.bots.get(data.target);
          const eventData = { ...data, ip: socket.handshake.address };
          if (targetBot) {
            targetBot.socket.emit('commandResponse', eventData);
            console.log(`📤 [${new Date().toISOString()}] Sent commandResponse to ${targetBot.name} (${targetBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'commandResponse', eventData, target: data.target });
            console.warn(`⚠️ [${new Date().toISOString()}] Queued commandResponse for ${data.target}`);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] Error in commandResponse:`, error.message);
        }
      });

      socket.on('disconnect', (reason) => {
        const clientName = socket.clientName || Array.from(this.bots.entries()).find(([_, bot]) => bot.socketId === socket.id)?.[0];
        if (clientName) {
          this.bots.delete(clientName);
          console.log(`❌ [${new Date().toISOString()}] ${clientName} disconnected. Remaining bots:`, Array.from(this.bots.keys()));
        }
        console.log(`🔌 [${new Date().toISOString()}] Client ${socket.id} disconnected: ${reason}`);
      });
    });
  }
}

export default WebSocketHandler;