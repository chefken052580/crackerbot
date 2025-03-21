// bot_frontend/src/utils/WebSocketManager.js
import io from "socket.io-client";

class WebSocketManager {
  constructor(url, { onConnect, onMessage, onTyping, onConnectError, onDisconnect }) {
    this.socket = io(url, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket"],
      path: "/socket.io",
    });

    this.socket.on("connect", () => onConnect(this.socket.id));
    this.socket.on("message", onMessage);
    this.socket.on("typing", onTyping);
    this.socket.on("connect_error", (error) => onConnectError(error));
    this.socket.on("disconnect", onDisconnect);
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  disconnect() {
    this.socket.off("connect");
    this.socket.off("message");
    this.socket.off("typing");
    this.socket.off("connect_error");
    this.socket.off("disconnect");
    this.socket.disconnect();
  }

  connect() {
    this.socket.connect();
  }
}

export default WebSocketManager;