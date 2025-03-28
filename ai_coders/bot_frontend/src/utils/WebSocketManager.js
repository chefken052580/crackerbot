// bot_frontend/src/utils/WebSocketManager.js
// Version: v2025-03-28-1
import io from "socket.io-client";

class WebSocketManager {
  constructor(url, { onConnect, onMessage, onTyping, onConnectError, onDisconnect }) {
    this.url = url;
    this.callbacks = { onConnect, onMessage, onTyping, onConnectError, onDisconnect };
    this.messageQueue = [];
    this.socket = io(url, {
      reconnection: true,
      reconnectionAttempts: Infinity, // Match bot_backend for robustness
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      transports: ["websocket"],
      path: "/socket.io",
    });

    this.socket.on("connect", () => {
      console.log(`🌌 WebSocketManager: Connected to cosmic relay at ${url} with ID: ${this.socket.id}`);
      this.callbacks.onConnect(this.socket.id);
      this.flushQueue();
    });

    this.socket.on("message", (data) => {
      console.log(`🌠 WebSocketManager: Received cosmic message:`, data);
      this.callbacks.onMessage(data);
    });

    this.socket.on("typing", this.callbacks.onTyping || (() => {}));

    this.socket.on("connect_error", (error) => {
      console.error(`💥 WebSocketManager: Cosmic link severed: ${error.message}`);
      this.callbacks.onConnectError(error);
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`⚡️ WebSocketManager: Drifted from cosmic relay. Reason: ${reason}`);
      this.callbacks.onDisconnect(reason);
    });

    // Heartbeat to ensure server health
    this.heartbeatInterval = setInterval(() => {
      if (this.socket.connected) {
        this.emit("heartbeat", { bot: "bot_frontend" });
        console.log("🌟 WebSocketManager: Heartbeat pulsing with cosmic energy!");
      }
    }, 30000);
  }

  emit(event, data, callback) {
    const message = { event, data, callback };
    if (this.socket.connected) {
      this.socket.emit(event, data, callback);
      console.log(`📡 WebSocketManager: Emitted ${event} with data:`, data);
    } else {
      this.messageQueue.push(message);
      console.log(`🌙 WebSocketManager: Queued ${event} due to disconnect`);
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0 && this.socket.connected) {
      const { event, data, callback } = this.messageQueue.shift();
      this.socket.emit(event, data, callback);
      console.log(`🚀 WebSocketManager: Flushed queued ${event}`);
    }
  }

  disconnect() {
    clearInterval(this.heartbeatInterval);
    this.socket.off("connect");
    this.socket.off("message");
    this.socket.off("typing");
    this.socket.off("connect_error");
    this.socket.off("disconnect");
    this.socket.disconnect();
    console.log("🛸 WebSocketManager: Disconnected from cosmic grid");
  }

  connect() {
    this.socket.connect();
    console.log("🔗 WebSocketManager: Attempting to reconnect to cosmic relay");
  }
}

export default WebSocketManager;