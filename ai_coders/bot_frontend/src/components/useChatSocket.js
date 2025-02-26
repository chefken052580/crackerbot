import { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const useChatSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSocket = useCallback(() => {
    console.log("Attempting to connect to:", WEBSOCKET_SERVER_URL);
    const newSocket = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
      path: '/socket.io'
    });

    newSocket.on("connect", () => {
      console.log("Connected, ID:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connect error:", error.message);
      setIsConnected(false);
    });

    newSocket.on("connect_timeout", () => {
      console.error("Connect timeout");
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("Error:", error.message);
    });

    setSocket(newSocket);
    return newSocket;
  }, []);

  useEffect(() => {
    const currentSocket = connectSocket();
    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
        console.log("Disconnected on cleanup");
      }
    };
  }, [connectSocket]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      console.log('Manual reconnect triggered');
      setSocket(connectSocket());
    }
  }, [socket, connectSocket]);

  const isSocketConnected = useCallback(() => {
    return isConnected && socket && socket.connected;
  }, [isConnected, socket]);

  return { socket, reconnect, isSocketConnected };
};

export default useChatSocket;