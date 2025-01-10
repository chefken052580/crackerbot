const { io } = require("socket.io-client");

const WEBSOCKET_SERVER_URL = "http://websocket_server:5002"; // Note: HTTP for Socket.IO

const socket = io(WEBSOCKET_SERVER_URL);

socket.on("connect", () => {
  console.log("Bot Frontend connected to WebSocket!");
  socket.emit("register", {
    name: "bot_frontend",
    role: "frontend",
  });
});

socket.on("message", (message) => {
  console.log("Message received by Bot Frontend:", message);
  // Here you might want to handle or broadcast the message to the UI
});

socket.on("connect_error", (error) => {
  console.error("WebSocket error in Bot Frontend:", error);
});

socket.on("disconnect", (reason) => {
  console.log("Bot Frontend WebSocket disconnected. Reason: ", reason);
  console.log("Attempting to reconnect in 5 seconds...");
  // Note: Reconnection is handled by Socket.IO automatically, but we log it
});

module.exports = socket;