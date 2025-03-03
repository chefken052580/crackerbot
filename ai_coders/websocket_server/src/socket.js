const { Server } = require("socket.io");

class WebSocketHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      pingInterval: 25000, // Send a ping packet every 25 seconds
      pingTimeout: 60000, // Disconnect after 60 seconds of no response
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
      console.log(`🔗 New client connected: ID ${socket.id}`);

      socket.on("register", ({ name, role }) => {
        this.registerClient(socket, { name, role });
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
      return;
    }
    this.clients[name] = socket;
    console.log(`✅ ${name} (${role}) registered successfully.`);
  }

  handleMessage(socket, message) {
    try {
      console.log(`📩 Received message: ${JSON.stringify(message)}`);
      switch (message.type) {
        case "command":
          this.forwardCommand(message);
          break;
        case "general_message":
          this.broadcastMessage(message);
          break;
        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`);
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
      console.error(`⚠️ Target bot "${target}" not found.`);
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
      console.log(`❌ ${clientName} disconnected (${reason}).`);
    }
  }
}

module.exports = WebSocketHandler;
