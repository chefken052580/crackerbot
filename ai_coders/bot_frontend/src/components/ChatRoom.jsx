import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

const commands = [
  { command: "/list_bot_health", description: "List Bot Health" },
  { command: "/show_bot_tasks", description: "Show Bot Tasks" },
  { command: "/start_task", description: "Start New Task" },
  { command: "/stop_bots", description: "Stop All Bots" },
  { command: "/list_projects", description: "List All Projects" },
];

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";
const MAX_RECONNECT_ATTEMPTS = 5;

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log("Initializing WebSocket connection to:", WEBSOCKET_SERVER_URL);
    const newSocket = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
      path: '/socket.io'
    });

    setSocket(newSocket);

    let reconnectTimer;
    const handleReconnect = () => {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.error('Socket disconnected. Attempting to reconnect...');
        newSocket.connect();
        setMessages(prev => [...prev, { user: "System", text: "Attempting to reconnect...", type: 'system' }]);
        setReconnectAttempts(prev => prev + 1);
        reconnectTimer = setTimeout(handleReconnect, 5000);
      } else {
        console.error("Max reconnect attempts reached.");
        setMessages(prev => [...prev, { user: "System", text: "Failed to reconnect after max attempts. Please refresh.", type: 'system' }]);
      }
    };

    newSocket.on('connect', () => {
      console.log('Socket connected successfully, ID:', newSocket.id);
      setMessages(prev => [...prev, { user: "System", text: "Connected to WebSocket", type: 'system' }]);
      setIsConnected(true);
      setReconnectAttempts(0);
      newSocket.emit('register', { name: "bot_frontend", role: "frontend" });
    });

    newSocket.on('message', (data) => {
      console.log('Received message:', data);
      setMessages(prev => [...prev, { user: data.user || "Bot", text: data.text, type: 'bot' }]);
    });

    newSocket.on('commandResponse', (response) => {
      console.log('Command response:', response);
      setMessages(prev => [...prev, {
        user: response.user || "System",
        text: response.success ? response.response : `Error: ${response.error || "Unknown error"}`,
        type: 'system'
      }]);
    });

    newSocket.on('response', (data) => { // Added to handle bot responses
      console.log('Response from bot:', data);
      setMessages(prev => [...prev, {
        user: data.user || "Bot",
        text: data.success ? data.response : `Error: ${data.error || "Unknown error"}`,
        type: 'system'
      }]);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Raw connect error:', error);
      setMessages(prev => [...prev, { user: "System", text: `Connection Error: ${error.message || error}`, type: 'system' }]);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setMessages(prev => [...prev, { user: "System", text: `Disconnected: ${reason}`, type: 'system' }]);
      setIsConnected(false);
      handleReconnect();
    });

    newSocket.on('error', (error) => {
      console.error('Raw WebSocket error:', error);
      setMessages(prev => [...prev, { user: "System", text: `WebSocket Error: ${error.message || error}`, type: 'system' }]);
    });

    return () => {
      clearTimeout(reconnectTimer);
      newSocket.disconnect();
      console.log("WebSocket disconnected on cleanup");
      newSocket.off('connect');
      newSocket.off('message');
      newSocket.off('commandResponse');
      newSocket.off('response');
      newSocket.off('connect_error');
      newSocket.off('disconnect');
      newSocket.off('error');
    };
  }, [reconnectAttempts]);

  const sendMessage = () => {
    if (socket && input.trim()) {
      if (isConnected) {
        if (input.startsWith("/")) {
          socket.emit('command', { command: input, user: "Admin", target: "bot_lead" });
        } else {
          socket.emit('message', { type: "message", text: input, user: "Admin" });
        }
        setMessages(prev => [...prev, { user: "Admin", text: input, type: 'user' }]);
        setInput("");
      } else {
        console.error('Socket is not connected.');
        setMessages(prev => [...prev, { user: "System", text: "Socket is not connected. Please try again later.", type: 'system' }]);
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setShowCommands(value.startsWith("/"));
  };

  const handleCommandSelect = (command) => {
    setInput(command);
    setShowCommands(false);
  };

  const manualReconnect = () => {
    if (socket) {
      console.log('Manual reconnect triggered');
      socket.disconnect();
      socket.connect();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 text-gray-300">
      <h2 className="text-2xl font-bold text-neon-yellow mb-4">Bot Chat Room</h2>
      <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg p-4 bg-gray-800">
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
      </div>
      {showCommands && (
        <div className="absolute bg-gray-800 border border-gray-600 rounded-md shadow-md p-2 mt-2 z-10">
          {commands.map((cmd) => (
            <div
              key={cmd.command}
              onClick={() => handleCommandSelect(cmd.command)}
              className="cursor-pointer p-2 hover:bg-gray-700 rounded-md"
            >
              <span className="text-neon-yellow font-bold">{cmd.command}</span> - {cmd.description}
            </div>
          ))}
        </div>
      )}
      <div className="flex mt-4 relative">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message or command..."
          className="flex-1 p-2 rounded-l-md bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-neon-yellow"
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-neon-green text-gray-900 px-4 py-2 rounded-r-md hover:bg-neon-yellow transition"
        >
          Send
        </button>
      </div>
      <button
        onClick={manualReconnect}
        className="mt-2 bg-neon-blue text-gray-900 px-4 py-2 rounded hover:bg-neon-yellow transition"
      >
        Manual Reconnect
      </button>
    </div>
  );
};

export default ChatRoom;