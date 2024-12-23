class WebSocketHandler {
    constructor(wss, clients) {
      this.wss = wss;
      this.clients = clients;
      this.initializeHandlers();
    }
  
    initializeHandlers() {
      this.wss.on("connection", (ws) => {
        console.log("New client connected!");
  
        ws.on("message", (message) => {
          this.handleMessage(ws, message);
        });
  
        ws.on("close", () => {
          this.handleDisconnect(ws);
        });
  
        ws.on("error", (error) => {
          console.error("WebSocket error:", error.message);
        });
      });
    }
  
    handleMessage(ws, message) {
      try {
        const data = JSON.parse(message);
        console.log("Message received:", data);
  
        switch (data.type) {
          case "register":
            this.registerClient(ws, data);
            break;
  
          case "command":
            this.forwardCommand(data);
            break;
  
          default:
            console.warn(`Unknown message type: ${data.type}`);
            break;
        }
      } catch (error) {
        console.error("Error handling message:", error.message);
      }
    }
  
    registerClient(ws, { name, role }) {
      if (!name || !role) {
        console.error("Invalid registration data.");
        return;
      }
      this.clients[name] = ws;
      console.log(`${name} (${role}) registered.`);
    }
  
    forwardCommand({ target, command, args }) {
      const targetClient = this.clients[target];
      if (targetClient) {
        targetClient.send(JSON.stringify({ type: "command", command, args }));
        console.log(`Command "${command}" forwarded to ${target}.`);
      } else {
        console.error(`Target bot "${target}" not found.`);
      }
    }
  
    handleDisconnect(ws) {
      for (const [name, client] of Object.entries(this.clients)) {
        if (client === ws) {
          delete this.clients[name];
          console.log(`${name} disconnected and removed.`);
          break;
        }
      }
    }
  }
  
  module.exports = WebSocketHandler;
  