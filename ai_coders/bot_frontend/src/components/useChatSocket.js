import { useState, useEffect } from "react";
import io from "socket.io-client";

const useChatSocket = (serverUrl) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl]);

  return socket;
};

export default useChatSocket;