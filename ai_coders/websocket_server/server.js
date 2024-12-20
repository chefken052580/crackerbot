const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");

const app = express();
app.use(cors());

// Health check endpoint
app.get("/", (req, res) => res.send("WebSocket Server is running!"));

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store registered clients
const clients = {};

wss.on("connection", (ws) => {
  console.log("New client connected!");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Message received:", data);

      switch (data.type) {
        case "register":
          registerClient(ws, data);
          break;
        case "command":
          forwardCommand(data);
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error("Error parsing message:", error.message);
    }
  });

  ws.on("close", () => handleDisconnect(ws));
  ws.on("error", (error) => console.error("WebSocket error:", error.message));
});

function registerClient(ws, { name, role }) {
  if (!name || !role) {
    console.error("Invalid registration data.");
    return;
  }
  clients[name] = ws;
  console.log(`${name} (${role}) registered.`);
}

function forwardCommand({ target, command, args }) {
  const targetClient = clients[target];
  if (targetClient) {
    targetClient.send(JSON.stringify({ type: "command", command, args }));
    console.log(`Command "${command}" forwarded to ${target}.`);
  } else {
    console.error(`Target bot "${target}" not found.`);
  }
}

function handleDisconnect(ws) {
  for (const [name, client] of Object.entries(clients)) {
    if (client === ws) {
      delete clients[name];
      console.log(`${name} disconnected and removed.`);
      break;
    }
  }
}

// Start the server
const PORT = process.env.PORT || 5002;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});
