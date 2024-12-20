const WebSocket = require("ws");

const ws = new WebSocket("ws://websocket_server:5002");

ws.on("open", () => {
  console.log("Bot Frontend connected to WebSocket!");
  ws.send(
    JSON.stringify({
      type: "register",
      name: "bot_frontend",
      role: "frontend",
    })
  );
});

ws.on("message", (message) => {
  console.log("Message received by Bot Frontend:", message);
});

ws.on("error", (error) => {
  console.error("WebSocket error in Bot Frontend:", error);
});

ws.on("close", () => {
  console.log("Bot Frontend WebSocket connection closed. Reconnecting...");
  setTimeout(() => {
    require("./socket");
  }, 5000);
});

module.exports = ws;
