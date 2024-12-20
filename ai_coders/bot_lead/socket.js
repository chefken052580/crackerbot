const WebSocket = require("ws");

// Connect to WebSocket server using the Docker service name
const ws = new WebSocket("ws://websocket_server:5002");

ws.on("open", () => {
  console.log("Bot Lead connected to WebSocket!");
  ws.send(
    JSON.stringify({
      type: "register",
      name: "bot_lead",
      role: "lead",
    })
  );
});

ws.on("message", (message) => {
  console.log("Message received by Bot Lead:", message);
});

ws.on("error", (error) => {
  console.error("WebSocket error in Bot Lead:", error);
});

ws.on("close", () => {
  console.log("Bot Lead WebSocket connection closed. Reconnecting...");
  setTimeout(() => {
    require("./socket"); // Reconnect
  }, 5000);
});

module.exports = ws;
