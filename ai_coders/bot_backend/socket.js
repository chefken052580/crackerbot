const WebSocket = require("ws");

// Connect to WebSocket server using the Docker service name
const ws = new WebSocket("ws://websocket_server:5002");

// When the connection is open
ws.on("open", () => {
  console.log("Bot Backend connected to WebSocket!");
  ws.send(
    JSON.stringify({
      type: "register",
      name: "bot_backend",
      role: "backend",
    })
  );
});

// When a message is received
ws.on("message", (message) => {
  console.log("Message received by Bot Backend:", message);
});

// Handle errors
ws.on("error", (error) => {
  console.error("WebSocket error in Bot Backend:", error);
});

// Handle connection closure
ws.on("close", () => {
  console.log("Bot Backend WebSocket connection closed. Reconnecting...");
  setTimeout(() => {
    require("./socket"); // Reconnect
  }, 5000);
});

module.exports = ws;
