// bot_frontend/src/utils/WebSocketManager.js
// Version: v2025-04-03-03
// Cosmic WebSocket relay for CrackerBot—forged with xAI’s supernova precision!

import io from "socket.io-client";

/**
 * WebSocketManager class for managing cosmic connections to the CrackerBot galaxy.
 * @class
 * @param {string} url - WebSocket server URL
 * @param {Object} options - Callback options
 * @param {Function} options.onConnect - Called on connection with socket ID
 * @param {Function} options.onMessage - Called on message receipt with data
 * @param {Function} [options.onTyping] - Called on typing event
 * @param {Function} options.onConnectError - Called on connection error with error object
 * @param {Function} options.onDisconnect - Called on disconnection with reason
 */
class WebSocketManager {
  constructor(url, { onConnect, onMessage, onTyping, onConnectError, onDisconnect }) {
    this.url = url;
    this.callbacks = { onConnect, onMessage, onTyping, onConnectError, onDisconnect };
    this.messageQueue = [];
    this.socket = io(url, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      transports: ["websocket"],
      path: "/socket.io",
    });

    this.socket.on("connect", () => {
      console.log(`[${new Date().toISOString()}] 🌌 WebSocketManager: Warped into cosmic relay at ${url}—ID: ${this.socket.id}`);
      this.callbacks.onConnect(this.socket.id);
      this.flushQueue();
    });

    this.socket.on("message", (data) => {
      console.log(`[${new Date().toISOString()}] 🌠 WebSocketManager: Cosmic signal intercepted:`, data);
      this.callbacks.onMessage(data);
    });

    this.socket.on("typing", this.callbacks.onTyping || (() => {}));

    this.socket.on("connect_error", (error) => {
      console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Galactic link fractured: ${error.message}`);
      this.callbacks.onConnectError(error);
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`[${new Date().toISOString()}] ⚡️ WebSocketManager: Ejected from cosmic grid—Reason: ${reason}`);
      this.callbacks.onDisconnect(reason);
    });

    this.socket.on("reconnect", (attempt) => {
      console.log(`[${new Date().toISOString()}] 🔄 WebSocketManager: Re-warped after ${attempt} cosmic retries`);
    });

    this.heartbeatInterval = setInterval(() => {
      if (this.socket.connected) {
        this.emit("heartbeat", { bot: "bot_frontend" });
        console.log(`[${new Date().toISOString()}] 🌟 WebSocketManager: Pulsing with interstellar vitality!`);
      }
    }, 30000);
  }

  /**
   * Emits an event to the WebSocket server, queuing if disconnected.
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Function} [callback] - Optional callback for acknowledgment
   */
  emit(event, data, callback) {
    const message = { event, data, callback };
    try {
      if (this.socket.connected) {
        this.socket.emit(event, data, callback);
        console.log(`[${new Date().toISOString()}] 📡 WebSocketManager: Beamed ${event} into the cosmos:`, data);
      } else {
        this.messageQueue.push(message);
        console.log(`[${new Date().toISOString()}] 🌙 WebSocketManager: Stashed ${event} in cosmic queue`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Emission failed for ${event}: ${err.message}`);
    }
  }

  /**
   * Flushes queued messages when connection is restored.
   */
  flushQueue() {
    while (this.messageQueue.length > 0 && this.socket.connected) {
      try {
        const { event, data, callback } = this.messageQueue.shift();
        this.socket.emit(event, data, callback);
        console.log(`[${new Date().toISOString()}] 🚀 WebSocketManager: Launched queued ${event} into orbit`);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Queue flush error: ${err.message}`);
      }
    }
  }

  /**
   * Disconnects from the WebSocket server and cleans up resources.
   */
  disconnect() {
    clearInterval(this.heartbeatInterval);
    try {
      this.socket.off("connect");
      this.socket.off("message");
      this.socket.off("typing");
      this.socket.off("connect_error");
      this.socket.off("disconnect");
      this.socket.off("reconnect");
      this.socket.disconnect();
      this.messageQueue = [];
      console.log(`[${new Date().toISOString()}] 🛸 WebSocketManager: Detached from cosmic network`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Disconnect error: ${err.message}`);
    }
  }

  /**
   * Attempts to reconnect to the WebSocket server.
   */
  connect() {
    try {
      this.socket.connect();
      console.log(`[${new Date().toISOString()}] 🔗 WebSocketManager: Re-aligning with cosmic relay`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Reconnect error: ${err.message}`);
    }
  }

  /**
   * Checks if the WebSocket is currently connected.
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.socket.connected;
  }
}

export default WebSocketManager;