// bot_frontend/src/utils/WebSocketManager.js
// Version: v2025-07-30-06
/**
 * WebSocket Manager
 * Handles WebSocket connections for CrackerBot frontend with cosmic precision.
 * Enhanced by xAI for robust reconnection, session persistence, message handling, singleton pattern,
 * enhanced diagnostics, and aggressive reconnection retries.
 *
 * @version 2025-07-30-06
 * @author CrackerBot Team, enhanced by xAI
 * @module WebSocketManager
 */

import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

let instance = null;

/**
 * WebSocketManager class for managing cosmic connections to the CrackerBot galaxy (singleton).
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
    if (instance) {
      console.log(`[${new Date().toISOString()}] 🔄 WebSocketManager: Returning existing singleton instance`);
      return instance;
    }
    instance = this;

    this.url = process.env.REACT_APP_WEBSOCKET_URL || 'wss://<your-ngrok-websocket-url>.ngrok-free.app';
    this.callbacks = {
      onConnect,
      onMessage,
      onTyping: onTyping || (() => {}),
      onConnectError,
      onDisconnect,
    };
    this.messageQueue = [];
    this.frontendId = localStorage.getItem('frontendId') || uuidv4();
    this.sessionId = localStorage.getItem('sessionId') || uuidv4();
    this.userName = localStorage.getItem('crackerBotUserName') || 'Guest';
    localStorage.setItem('frontendId', this.frontendId);
    localStorage.setItem('sessionId', this.sessionId);
    localStorage.setItem('crackerBotUserName', this.userName);
    this.sessionIdLocked = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 30;
    this.reconnectInterval = 500;
    this.reconnectDelayMax = 5000;
    this.socket = null;
    this.isConnecting = false;
    this.isRegistered = false;
    this.connectTimeout = null;
    this.heartbeatInterval = null;
    this.lastConnectAttempt = 0;

    console.log(`[${new Date().toISOString()}] 🌌 WebSocketManager: Initializing singleton with URL: ${this.url}, frontendId: ${this.frontendId}, sessionId: ${this.sessionId}, userName: ${this.userName}`);
    this.initializeSocket();
  }

  /**
   * Initializes the WebSocket connection with event listeners.
   */
  initializeSocket() {
    const now = Date.now();
    if (this.isConnecting || this.socket?.connected || (now - this.lastConnectAttempt < this.reconnectInterval)) {
      console.log(`[${new Date().toISOString()}] 🔄 WebSocketManager: Skipping initialization, connected=${this.socket?.connected}, connecting=${this.isConnecting}, time since last attempt=${now - this.lastConnectAttempt}ms`);
      return;
    }
    this.isConnecting = true;
    this.lastConnectAttempt = now;
    this.reconnectAttempts++;

    console.log(`[${new Date().toISOString()}] 🌌 WebSocketManager: Attempting connection to ${this.url}, attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      if (this.socket) {
        this.socket.off('connect');
        this.socket.off('message');
        this.socket.off('typing');
        this.socket.off('connect_error');
        this.socket.off('disconnect');
        this.socket.off('error');
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(this.url, {
        reconnection: false,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        reconnectionDelayMax: this.reconnectDelayMax,
        timeout: 10000,
        transports: ['websocket'],
        path: '/socket.io',
        query: { frontendId: this.frontendId, sessionId: this.sessionIdLocked ? this.sessionId : uuidv4(), userName: this.userName },
        forceNew: false,
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      this.socket.on('connect', () => {
        console.log(`[${new Date().toISOString()}] 🌌 WebSocketManager: Warped into cosmic relay at ${this.url}—ID: ${this.socket.id}, frontendId: ${this.frontendId}, sessionId: ${this.sessionId}, userName: ${this.userName}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.isRegistered = true;
        if (this.connectTimeout) clearTimeout(this.connectTimeout);
        this.callbacks.onConnect(this.frontendId);
        this.socket.emit('register', {
          name: 'frontend',
          role: 'frontend',
          frontendId: this.frontendId,
        });
        this.socket.emit('frontend_connected', {
          ip: window.location.hostname,
          frontendId: this.frontendId,
          userName: this.userName,
          sessionId: this.sessionId,
        });
        console.log(`[${new Date().toISOString()}] 📡 WebSocketManager: Emitted frontend_connected with userName: ${this.userName}, sessionId: ${this.sessionId}, frontendId: ${this.frontendId}`);
        this.flushQueue();

        if (!this.heartbeatInterval) {
          this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
              this.emit('heartbeat', { bot: 'bot_frontend', frontendId: this.frontendId });
              console.log(`[${new Date().toISOString()}] 🌟 WebSocketManager: Pulsing with interstellar vitality!`);
            }
          }, 8000);
        }
      });

      this.socket.on('message', (data) => {
        console.log(`[${new Date().toISOString()}] 🌠 WebSocketManager: Cosmic signal intercepted:`, data);
        this.callbacks.onMessage(data);
      });

      this.socket.on('typing', (data) => {
        console.log(`[${new Date().toISOString()}] ✍️ WebSocketManager: Typing signal received:`, data);
        this.callbacks.onTyping(data);
      });

      this.socket.on('connect_error', (error) => {
        console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Galactic link fractured: ${error.message}, attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}, URL: ${this.url}, details:`, error);
        this.callbacks.onConnectError(error);
        this.isConnecting = false;
        this.isRegistered = false;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error(`[${new Date().toISOString()}] ❌ WebSocketManager: Max reconnection attempts reached`);
          this.callbacks.onConnectError(new Error('Max reconnection attempts reached'));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[${new Date().toISOString()}] ⚡️ WebSocketManager: Ejected from cosmic grid—Reason: ${reason}, URL: ${this.url}`);
        this.callbacks.onDisconnect(reason);
        this.isConnecting = false;
        this.isRegistered = false;
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
      });

      this.socket.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Socket error: ${error.message}, URL: ${this.url}`);
      });

      this.connectTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.error(`[${new Date().toISOString()}] ❌ WebSocketManager: Connection timeout after 10s, URL: ${this.url}`);
          this.isConnecting = false;
          this.isRegistered = false;
          this.callbacks.onConnectError(new Error('Connection timeout'));
        }
      }, 10000);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] 💥 WebSocketManager: Initialization error: ${err.message}, URL: ${this.url}`);
      this.isConnecting = false;
      this.callbacks.onConnectError(err);
    }
  }

  /**
   * Emits an event to the WebSocket server, queuing if disconnected.
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Function} [callback] - Optional callback for acknowledgment
   */
  emit(event, data, callback) {
    const message = { event, data: { ...data, frontendId: this.frontendId, sessionId: this.sessionId }, callback, attempts: 0, maxAttempts: 5, timestamp: Date.now() };
    const emitMessage = () => {
      try {
        if (this.socket?.connected) {
          this.socket.emit(event, message.data, (ack) => {
            if (callback) callback(ack);
            console.log(`[${new Date().toISOString()}] 📡 WebSocketManager: Beamed ${event} into the cosmos:`, message.data);
          });
        } else {
          this.messageQueue.push(message);
          console.log(`[${new Date().toISOString()}] 🌙 WebSocketManager: Stashed ${event} in cosmic queue—Pending connection, queue size: ${this.messageQueue.length}`);
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
   * Flushes queued messages when connection is restored.
   */
  flushQueue() {
    while (this.messageQueue.length > 0 && this.socket?.connected) {
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
          setTimeout(() => this.flushQueue(), 1000 * message.attempts);
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
   * Sets the user name and persists it in localStorage.
   * @param {string} userName - The user name to set
   */
  setUserName(userName) {
    this.userName = /^[a-zA-Z0-9_-]{1,20}$/.test(userName) ? userName : 'Guest';
    localStorage.setItem('crackerBotUserName', this.userName);
    console.log(`[${new Date().toISOString()}] 🌟 WebSocketManager: User name set to ${this.userName}`);
    if (this.socket?.connected) {
      this.socket.emit('frontend_connected', {
        ip: window.location.hostname,
        frontendId: this.frontendId,
        userName: this.userName,
        sessionId: this.sessionId,
      });
      console.log(`[${new Date().toISOString()}] 📡 WebSocketManager: Re-emitted frontend_connected with userName: ${this.userName}, sessionId: ${this.sessionId}`);
    }
  }

  /**
   * Unlocks sessionId for reset (e.g., during /warp_reconnect).
   */
  unlockSessionId() {
    this.sessionId = uuidv4();
    this.sessionIdLocked = false;
    localStorage.setItem('sessionId', this.sessionId);
    console.log(`[${new Date().toISOString()}] 🔓 WebSocketManager: Session ID unlocked and reset to ${this.sessionId}`);
  }

  /**
   * Disconnects from the WebSocket server and cleans up resources.
   */
  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    try {
      this.socket?.off('connect');
      this.socket?.off('message');
      this.socket?.off('typing');
      this.socket?.off('connect_error');
      this.socket?.off('disconnect');
      this.socket?.off('error');
      this.socket?.disconnect();
      this.isConnecting = false;
      this.isRegistered = false;
      this.socket = null;
      console.log(`[${new Date().toISOString()}] 🛸 WebSocketManager: Detached from cosmic network—Queue preserved with ${this.messageQueue.length} messages`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ WebSocketManager: Disconnect error: ${err.message}`);
    }
  }

  /**
   * Checks if the WebSocket is currently connected.
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.socket?.connected || false;
  }
}

export default WebSocketManager;