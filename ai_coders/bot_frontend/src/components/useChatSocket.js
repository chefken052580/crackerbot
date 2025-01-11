import { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";

const useChatSocket = (serverUrl) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSocket = useCallback(() => {
    console.log("Attempting to connect to WebSocket server at:", serverUrl);
    let newSocket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket']
    });

    newSocket.on("connect", () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
    });

    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("WebSocket Disconnected:", reason);
      setIsConnected(false);
    });

    setSocket(newSocket);
    return newSocket;
  }, [serverUrl]);

  useEffect(() => {
    let currentSocket = connectSocket();

    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
      }
    };
  }, [connectSocket]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      console.log('Manually triggering reconnection');
      setSocket(connectSocket());
    }
  }, [socket, connectSocket]);

  const isSocketConnected = () => {
    return isConnected && socket && socket.connected;
  };

  return { socket, reconnect, isSocketConnected };
};

export default useChatSocket;