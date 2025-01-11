const { Server } = require("socket.io");

class WebSocketHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      pingInterval: 25000,  // Send a ping packet every 25 seconds
      pingTimeout: 60000,   // Disconnect after 60 seconds of no ping response
    });
    this.clients = {};
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`New client connected with ID: ${socket.id}`);

      socket.on("register", ({ name, role }) => {
        this.registerClient(socket, { name, role });
      });

      socket.on("message", (message) => {
        this.handleMessage(socket, message);
      });

      socket.on("disconnect", (reason) => {
        this.handleDisconnect(socket, reason);
      });

      socket.on("error", (error) => {
        console.error(`WebSocket error for client ${socket.id}:`, error.message);
      });
    });
  }

  handleMessage(socket, message) {
    try {
      switch (message.type) {
        case "command":
          this.forwardCommand(message);
          break;
        case "general_message": // Handle other message types if needed
          this.broadcastMessage(message);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error.message);
      socket.emit("error", { type: "error", message: `An error occurred: ${error.message}` });
    }
  }

  registerClient(socket, { name, role }) {
    if (!name || !role) {
      console.error("Invalid registration data.");
      return;
    }
    this.clients[name] = socket;
    console.log(`${name} (${role}) registered.`);
  }

  forwardCommand({ target, command, args }) {
    const targetClient = this.clients[target];
    if (targetClient) {
      targetClient.emit("command", { command, args });
      console.log(`Command "${command}" forwarded to ${target}.`);
    } else {
      console.error(`Target bot "${target}" not found.`);
      // Optionally, you could broadcast an error back to the sender
      // this.io.emit("error", { type: "error", message: `Target bot "${target}" not found.` });
    }
  }

  broadcastMessage(message) {
    this.io.emit("message", message); // Broadcasts to all connected clients
    console.log("Message broadcasted:", message);
  }

  handleDisconnect(socket, reason) {
    for (const [name, client] of Object.entries(this.clients)) {
      if (client === socket) {
        delete this.clients[name];
        console.log(`${name} disconnected (${reason}) and removed.`);
        break;
      }
    }
  }
}

module.exports = WebSocketHandler;