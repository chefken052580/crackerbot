// bot_frontend/src/utils/WebSocketManager.js
// Version: v2025-04-10-05
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
    this.callbacks = { onConnect, onMessage, onTyping: onTyping || (() => {}), onConnectError, onDisconnect };
    this.messageQueue = [];
    this.socket = io(url, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 60000,
      transports: ["websocket"],
      path: "/socket.io",
      randomizationFactor: 0.5,
      autoConnect: false, // Manual connect for control
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

    this.socket.on("typing", (data) => {
      console.log(`[${new Date().toISOString()}] ✍️ WebSocketManager: Typing signal received:`, data);
      this.callbacks.onTyping(data);
    });

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
      this.flushQueue();
    });

    this.socket.on("reconnect_attempt", (attempt) => {
      console.log(`[${new Date().toISOString()}] 🔄 WebSocketManager: Attempting reconnect #${attempt}`);
    });

    this.socket.on("error", (error) => {
      console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Cosmic error detected: ${error.message}`);
    });

    this.heartbeatInterval = setInterval(() => {
      if (this.socket.connected) {
        this.emit("heartbeat", { bot: "bot_frontend" });
        console.log(`[${new Date().toISOString()}] 🌟 WebSocketManager: Pulsing with interstellar vitality!`);
      }
    }, 30000);

    this.connect(); // Explicitly connect on instantiation
  }

  /**
   * Emits an event to the WebSocket server, queuing if disconnected with retry logic.
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Function} [callback] - Optional callback for acknowledgment
   */
  emit(event, data, callback) {
    const message = { event, data, callback, attempts: 0, maxAttempts: 5, timestamp: Date.now() };
    const emitMessage = () => {
      try {
        if (this.socket.connected) {
          this.socket.emit(event, data, (ack) => {
            if (callback) callback(ack);
            console.log(`[${new Date().toISOString()}] 📡 WebSocketManager: Beamed ${event} into the cosmos:`, data);
          });
        } else {
          this.messageQueue.push(message);
          console.log(`[${new Date().toISOString()}] 🌙 WebSocketManager: Stashed ${event} in cosmic queue—Pending connection`);
        }
      } catch (err) {
        message.attempts++;
        console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Emission failed for ${event} (Attempt ${message.attempts}/${message.maxAttempts}): ${err.message}`);
        if (message.attempts < message.maxAttempts) {
          this.messageQueue.push(message);
        } else {
          console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Abandoned ${event} after ${message.maxAttempts} failed attempts`);
        }
      }
    };

    emitMessage();
  }

  /**
   * Flushes queued messages when connection is restored with retry handling.
   */
  flushQueue() {
    while (this.messageQueue.length > 0 && this.socket.connected) {
      const message = this.messageQueue.shift();
      try {
        this.socket.emit(message.event, message.data, (ack) => {
          if (message.callback) message.callback(ack);
        });
        console.log(`[${new Date().toISOString()}] 🚀 WebSocketManager: Launched queued ${message.event} into orbit`);
      } catch (err) {
        message.attempts++;
        console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Queue flush error for ${message.event} (Attempt ${message.attempts}/${message.maxAttempts}): ${err.message}`);
        if (message.attempts < message.maxAttempts) {
          this.messageQueue.unshift(message);
          setTimeout(() => this.flushQueue(), 2000 * message.attempts); // Increased backoff
        } else {
          console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Dropped ${message.event} after ${message.maxAttempts} failed attempts`);
        }
      }
    }
    if (this.messageQueue.length > 0) {
      console.log(`[${new Date().toISOString()}] ⏳ WebSocketManager: ${this.messageQueue.length} messages remain queued—Awaiting reconnection`);
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
      this.socket.off("reconnect_attempt");
      this.socket.off("error");
      this.socket.disconnect();
      console.log(`[${new Date().toISOString()}] 🛸 WebSocketManager: Detached from cosmic network—Queue preserved with ${this.messageQueue.length} messages`);
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