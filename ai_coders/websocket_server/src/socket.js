import { Server } from 'socket.io';

class WebSocketHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      pingInterval: 25000,
      pingTimeout: 60000,
      cors: {
        origin: "https://visually-sterling-spider.ngrok-free.app",
        credentials: true,
        methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type"]
      }
    });
    this.clients = {};
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

      socket.on("register", ({ name, role }) => {
        this.registerClient(socket, { name, role });
        this.io.emit('register', { name, role, target: name, ip: socket.handshake.address });
        console.log(`📤 Forwarded register event to ${name} for ${name} with IP ${socket.handshake.address}`);
      });

      socket.on("frontend_connected", (data) => {
        console.log(`📩 Received frontend_connected: ${JSON.stringify(data)}`);
        const leadClient = this.clients['bot_lead'];
        if (leadClient) {
          const forwardedData = { ...data, ip: socket.handshake.address };
          leadClient.emit("frontend_connected", forwardedData);
          console.log(`📤 Forwarded frontend_connected to bot_lead with data: ${JSON.stringify(forwardedData)}`);
        } else {
          console.warn(`⚠️ bot_lead not found for frontend_connected. Clients: [${Object.keys(this.clients).join(', ')}]`);
          // Queue the event if bot_lead isn’t registered yet
          socket.once('register', ({ name }) => {
            if (name === 'bot_lead') {
              this.clients['bot_lead'].emit("frontend_connected", { ...data, ip: socket.handshake.address });
              console.log(`📤 Delayed forward of frontend_connected to newly registered bot_lead`);
            }
          });
        }
      });

      socket.on("message", (message) => {
        this.handleMessage(socket, message);
      });

      socket.on("command", (message) => {
        this.forwardCommand(message);
      });

      socket.on("commandResponse", (message) => {
        this.forwardCommandResponse(message);
      });

      socket.on("taskResponse", (message) => {
        this.forwardTaskResponse(message);
      });

      socket.on("disconnect", (reason) => {
        this.handleDisconnect(socket, reason);
      });

      socket.on("error", (error) => {
        console.error(`❌ WebSocket error for client ${socket.id}:`, error.message);
      });
    });
  }

  registerClient(socket, { name, role }) {
    if (!name || !role) {
      console.error("❌ Invalid registration data. Missing name or role.");
      socket.emit("register_failed", { message: "Missing name or role" });
      return;
    }
    this.clients[name] = socket;
    console.log(`✅ ${name} (${role}) registered successfully.`);
    console.log(`🚨 Debug: Registered bots: [ ${Object.keys(this.clients).join(', ')} ]`);
  }

  handleMessage(socket, message) {
    try {
      console.log(`📩 Message received: ${JSON.stringify(message)}`);
      const targetClient = this.clients[message.target || 'bot_lead'];
      if (targetClient) {
        const messageWithIp = { ...message, ip: socket.handshake.address };
        targetClient.emit("message", messageWithIp);
        console.log(`📤 Message forwarded to ${message.target || 'bot_lead'}: ${JSON.stringify(messageWithIp)}`);
      } else {
        console.warn(`⚠️ Target bot '${message.target || 'bot_lead'}' not found. Message: ${JSON.stringify(message)}`);
        console.log(`🚨 Debug: Registered bots: [ ${Object.keys(this.clients).join(', ')} ]`);
      }
    } catch (error) {
      console.error("❌ Error handling message:", error.message);
      socket.emit("error", { type: "error", message: `An error occurred: ${error.message}` });
    }
  }

  forwardCommand({ target, command, args }) {
    const targetClient = this.clients[target];
    if (targetClient) {
      targetClient.emit("command", { command, args });
      console.log(`🚀 Command "${command}" sent to ${target}`);
    } else {
      console.error(`⚠️ Target bot "${target}" not found for command.`);
      console.log(`🚨 Debug: Registered bots: [ ${Object.keys(this.clients).join(', ')} ]`);
    }
  }

  forwardCommandResponse({ target, response, success }) {
    const targetClient = this.clients[target];
    if (targetClient) {
      targetClient.emit("commandResponse", { response, success });
      console.log(`✅ CommandResponse sent to ${target}: ${response}`);
    } else {
      console.warn(`⚠️ Target bot "${target}" not found for CommandResponse.`);
    }
  }

  forwardTaskResponse({ target, taskId, status }) {
    const targetClient = this.clients[target];
    if (targetClient) {
      targetClient.emit("taskResponse", { taskId, status });
      console.log(`📤 TaskResponse sent to ${target}: Task ${taskId} is now ${status}`);
    } else {
      console.warn(`⚠️ Target bot "${target}" not found for TaskResponse.`);
    }
  }

  broadcastMessage(message) {
    this.io.emit("message", message);
    console.log("📢 Message broadcasted:", message);
  }

  handleDisconnect(socket, reason) {
    const clientName = Object.keys(this.clients).find(name => this.clients[name] === socket);
    if (clientName) {
      delete this.clients[clientName];
      console.log(`❌ ${clientName} disconnected. Remaining bots: [ ${Object.keys(this.clients).join(', ')} ]`);
    }
    console.log(`🔌 Client ${socket.id} disconnected: ${reason}`);
  }
}

export default WebSocketHandler;