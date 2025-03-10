import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    console.log("ChatRoom.jsx: Component mounted");
    // Dynamically set WebSocket URL based on the current host
    const WEBSOCKET_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/socket.io/`;
    console.log("ChatRoom.jsx: Connecting to:", WEBSOCKET_URL);

    const socket = io(WEBSOCKET_URL, {
      reconnection: true,
      transports: ["websocket"], // Force WebSocket transport
      path: "/socket.io/",       // Match Nginx proxy path
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("ChatRoom.jsx: ✅ Connected, ID:", socket.id);
      setIsConnected(true);
      setMessages((prev) => [...prev, { from: "System", text: "Connected!", timestamp: new Date().toLocaleTimeString() }]);
      socket.emit("register", { name: "bot_frontend", role: "frontend", userId: socket.id });
    });

    socket.on("connect_error", (error) => {
      console.error("ChatRoom.jsx: ❌ Connect error:", error.message);
      setConnectionError(`Failed to connect: ${error.message}`);
      setIsConnected(false);
    });

    socket.on("message", (data) => {
      console.log("ChatRoom.jsx: 📩 Message:", data);
      setMessages((prev) => [...prev, { ...data, timestamp: new Date().toLocaleTimeString() }]);
    });

    return () => {
      console.log("ChatRoom.jsx: Cleaning up");
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (!isConnected || !input) return;
    const msg = { text: input, from: "User", type: "user" };
    socketRef.current.emit("message", msg);
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date().toLocaleTimeString() }]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-300">
      <h1 className="p-4 text-2xl">ChatRoom Debug</h1>
      {connectionError && <p className="p-4 text-red-500">{connectionError}</p>}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-800">
        {messages.map((msg, idx) => (
          <div key={idx}>{`${msg.timestamp} [${msg.from}]: ${msg.text}`}</div>
        ))}
        {!isConnected && !connectionError && <div>Connecting...</div>}
      </div>
      <div className="p-4 flex">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-2 bg-gray-800 text-gray-300"
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button
          onClick={sendMessage}
          className="p-2 ml-2 bg-green-500 text-black"
          disabled={!isConnected}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;