const { io } = require("socket.io-client");

const WEBSOCKET_SERVER_URL = "ws://websocket_server:5002";

console.log("Attempting to connect to WebSocket at:", WEBSOCKET_SERVER_URL);

function connectSocket() {
  let socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket']
  });

  socket.on("connect", () => {
    console.log("Bot Frontend successfully connected to WebSocket!");
    console.log("Socket ID:", socket.id);
    socket.emit("register", {
      name: "bot_frontend",
      role: "frontend",
    });
    console.log("Registration sent to WebSocket server.");
  });

  socket.on("message", (message) => {
    console.log("Message received by Bot Frontend:", message);
    // Here you might want to handle or broadcast the message to the UI
    // Example: io.emit('message', message); if you were to relay this to clients
  });

  socket.on("commandResponse", (response) => {
    console.log("Command response received by Bot Frontend:", response);
    // Handle command response, perhaps relay it back to the UI or other clients
    // Example: io.emit('commandResponse', response);
  });

  socket.on("connect_error", (error) => {
    console.error("WebSocket connect error in Bot Frontend:", error);
  });

  socket.on("connect_timeout", () => {
    console.error("WebSocket connection timeout in Bot Frontend");
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log(`WebSocket reconnection attempt ${attemptNumber}`);
  });

  socket.on("reconnect_error", (error) => {
    console.error("WebSocket reconnection error:", error);
  });

  socket.on("reconnect_failed", () => {
    console.error("WebSocket reconnection failed after multiple attempts.");
  });

  socket.on("disconnect", (reason) => {
    console.log("Bot Frontend WebSocket disconnected. Reason:", reason);
    console.log("Attempting to reconnect...");
  });

  return socket;
}

module.exports = { connectSocket };