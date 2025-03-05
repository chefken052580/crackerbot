import io from 'socket.io-client';

const BOT_NAME = "bot_backend";
const WEBSOCKET_SERVER_URL = "ws://websocket_server:5002";

let retryCount = 0;
const maxRetries = Infinity;
const maxDelay = 60000;

function connectToWebSocket() {
  const socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay,
    timeout: 20000,
    transports: ['websocket'],
  });

  socket.on("connect", () => {
    console.log(`${BOT_NAME} connected to WebSocket!`);
    socket.emit("register", {
      name: BOT_NAME,
      role: "backend",
    });
    retryCount = 0;
  });

  socket.on("message", (data) => {
    console.log("Message or command received by Bot Backend:", data);
    if (data.type === 'command') {
      console.log("Command received:", data.command);
      socket.emit('response', { type: "response", user: BOT_NAME, text: `Command ${data.command} received, processing via HTTP on 5000` });
    } else if (data.type === 'message') {
      console.log("General message received:", data.text);
    }
  });

  socket.on("connect_error", (error) => {
    console.error("WebSocket error in Bot Backend:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`${BOT_NAME} WebSocket disconnected. Reason: `, reason);
    console.log("Attempting to reconnect...");
    retryCount++;
    const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
    console.log(`Retry attempt ${retryCount}, will retry in ${delay / 1000} seconds`);
    setTimeout(connectToWebSocket, delay);
  });

  return socket;
}

export const botSocket = connectToWebSocket();