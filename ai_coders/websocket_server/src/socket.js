import { Server } from 'socket.io';

class WebSocketHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      pingInterval: 25000,
      pingTimeout: 60000,
      cors: {
        origin: process.env.CORS_ORIGIN || "https://visually-sterling-spider.ngrok-free.app",
        methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
        credentials: true,
      },
    });
    this.bots = new Map();
    this.pendingEvents = [];
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

      socket.on('register', (data) => {
        try {
          if (!data || !data.name || !data.role) {
            console.error("❌ Registration failed: Missing name or role:", data);
            socket.emit("register_failed", "Missing name or role");
            return;
          }
          const botData = { name: data.name, role: data.role, socketId: socket.id };
          this.bots.set(data.name, botData);
          socket.clientName = data.name;
          console.log(`✅ ${data.name} (${data.role}) registered with ID ${socket.id}`);
          socket.emit("register_success"); // Confirm to client only

          const leadBot = this.bots.get('bot_lead');
          if (leadBot && data.role !== 'lead') {
            this.io.to(leadBot.socketId).emit('register', { ...data, ip: socket.handshake.address });
            console.log(`📤 Sent register to bot_lead (${leadBot.socketId}) for ${data.name}`);
          }
        } catch (error) {
          console.error("❌ Error in register:", error.message);
          socket.emit("error", { message: `Registration error: ${error.message}` });
        }
      });

      socket.on('frontend_connected', (data) => {
        try {
          const eventData = { ...data, frontendId: socket.id, ip: socket.handshake.address };
          console.log(`📩 Frontend connected: ${JSON.stringify(eventData)}`);
          const leadBot = this.bots.get('bot_lead');
          if (leadBot) {
            this.io.to(leadBot.socketId).emit('frontend_connected', eventData);
            console.log(`📤 Forwarded frontend_connected to bot_lead (${leadBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'frontend_connected', eventData, target: 'bot_lead' });
            console.log(`📥 Queued frontend_connected for bot_lead`);
          }
        } catch (error) {
          console.error("❌ Error in frontend_connected:", error.message);
        }
      });

      socket.on('reset_user', (data) => {
        try {
          const eventData = { ...data, frontendId: socket.id, ip: socket.handshake.address };
          console.log(`🔄 Reset_user from ${socket.id}: ${JSON.stringify(eventData)}`);
          const leadBot = this.bots.get('bot_lead');
          if (leadBot) {
            this.io.to(leadBot.socketId).emit('reset_user', eventData);
            console.log(`📤 Forwarded reset_user to bot_lead (${leadBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'reset_user', eventData, target: 'bot_lead' });
            console.warn(`⚠️ Queued reset_user for bot_lead`);
          }
        } catch (error) {
          console.error("❌ Error in reset_user:", error.message);
        }
      });

      socket.on('message', (data) => {
        try {
          if (!data || typeof data !== 'object') throw new Error("Invalid message format");
          console.log(`📩 Message received: ${JSON.stringify(data)}`);
          if (data.frontendId) {
            // Direct message to specific frontend client
            this.io.to(data.frontendId).emit('message', { ...data, ip: socket.handshake.address });
            console.log(`📤 Sent message to frontendId ${data.frontendId}`);
          } else {
            const targetBot = this.bots.get(data.target || 'bot_lead');
            const eventData = { ...data, ip: socket.handshake.address };
            if (targetBot) {
              this.io.to(targetBot.socketId).emit('message', eventData);
              console.log(`📤 Sent message to ${targetBot.name} (${targetBot.socketId})`);
            } else {
              this.pendingEvents.push({ event: 'message', eventData, target: data.target || 'bot_lead' });
              console.warn(`⚠️ Queued message for ${data.target || 'bot_lead'}`);
            }
          }
        } catch (error) {
          console.error("❌ Error in message handler:", error.message);
          socket.emit("error", { message: `Message error: ${error.message}` });
        }
      });

      socket.on('command', (data) => {
        try {
          if (!data.target || !data.command) throw new Error("Missing target or command");
          console.log(`🚀 Command received: ${JSON.stringify(data)}`);
          const targetBot = this.bots.get(data.target);
          const eventData = { ...data, ip: socket.handshake.address };
          if (targetBot) {
            this.io.to(targetBot.socketId).emit('command', eventData);
            console.log(`📤 Sent command to ${targetBot.name} (${targetBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'command', eventData, target: data.target });
            console.warn(`⚠️ Queued command for ${data.target}`);
          }
        } catch (error) {
          console.error("❌ Error in command handler:", error.message);
        }
      });

      socket.on('commandResponse', (data) => {
        try {
          if (!data.target) throw new Error("Missing target");
          console.log(`✅ CommandResponse: ${JSON.stringify(data)}`);
          const targetBot = this.bots.get(data.target);
          const eventData = { ...data, ip: socket.handshake.address };
          if (targetBot) {
            this.io.to(targetBot.socketId).emit('commandResponse', eventData);
            console.log(`📤 Sent commandResponse to ${targetBot.name} (${targetBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'commandResponse', eventData, target: data.target });
            console.warn(`⚠️ Queued commandResponse for ${data.target}`);
          }
        } catch (error) {
          console.error("❌ Error in commandResponse:", error.message);
        }
      });

      socket.on('taskResponse', (data) => {
        try {
          if (!data.target) throw new Error("Missing target");
          console.log(`📩 TaskResponse: ${JSON.stringify(data)}`);
          const targetBot = this.bots.get(data.target || 'bot_lead');
          const eventData = { ...data, ip: socket.handshake.address };
          if (targetBot) {
            this.io.to(targetBot.socketId).emit('taskResponse', eventData);
            console.log(`📤 Sent taskResponse to ${targetBot.name} (${targetBot.socketId})`);
          } else {
            this.pendingEvents.push({ event: 'taskResponse', eventData, target: data.target || 'bot_lead' });
            console.warn(`⚠️ Queued taskResponse for ${data.target || 'bot_lead'}`);
          }
        } catch (error) {
          console.error("❌ Error in taskResponse:", error.message);
        }
      });

      socket.on('disconnect', (reason) => {
        const clientName = socket.clientName || Array.from(this.bots.entries()).find(([_, bot]) => bot.socketId === socket.id)?.[0];
        if (clientName) {
          this.bots.delete(clientName);
          console.log(`❌ ${clientName} disconnected. Remaining bots:`, Array.from(this.bots.keys()));
        }
        console.log(`🔌 Client ${socket.id} disconnected: ${reason}`);
      });
    });
  }
}

export default WebSocketHandler;