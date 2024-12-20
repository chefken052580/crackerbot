const WebSocket = require("ws");

const ws = new WebSocket("ws://websocket_server:5002");

ws.on("open", () => {
  console.log("Connected to WebSocket server!");
});

ws.on("message", (message) => {
  console.log("Message received:", message);
});

ws.on("close", () => {
  console.log("WebSocket connection closed. Reconnecting...");
  setTimeout(() => {
    require("./socket"); // Reconnect
  }, 5000);
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

module.exports = ws;
