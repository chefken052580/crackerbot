import React, { useState, useEffect } from "react";
import useChatSocket from "./useChatSocket";
import ChatMessage from "./ChatMessage";

const commands = [
  { command: "/list_bot_health", description: "List Bot Health" },
  { command: "/show_bot_tasks", description: "Show Bot Tasks" },
  { command: "/start_task", description: "Start New Task" },
  { command: "/stop_bots", description: "Stop All Bots" },
  { command: "/list_projects", description: "List All Projects" },
];

const MAX_RECONNECT_ATTEMPTS = 5;

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { socket, reconnect, isSocketConnected } = useChatSocket("ws://websocket_server:5002");

  useEffect(() => {
    if (socket) {
      let reconnectTimer;
      const handleReconnect = () => {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          console.error('Socket disconnected. Attempting to reconnect...');
          reconnect();
          setMessages(prev => [...prev, { user: "System", text: "Attempting to reconnect...", type: 'system' }]);
          setReconnectAttempts(prev => prev + 1);
          reconnectTimer = setTimeout(handleReconnect, 5000); // Try reconnecting every 5 seconds
        } else {
          console.error("Failed to reconnect after multiple attempts.");
          setMessages(prev => [...prev, { user: "System", text: "Failed to reconnect after multiple attempts. Please refresh.", type: 'system' }]);
        }
      };

      socket.on('connect', () => {
        console.log('Socket connected successfully');
        setReconnectAttempts(0); // Reset attempts on successful connect
      });

      socket.on('message', (data) => {
        console.log('Received message:', data);
        setMessages(prev => [...prev, { ...data, type: 'bot' }]);
      });
      
      socket.on('commandResponse', (response) => {
        console.log('Command response:', response);
        setMessages(prev => [...prev, { 
          user: "System", 
          text: response.success ? response.response : `Error: ${response.error}`,
          type: 'system'
        }]);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setMessages(prev => [...prev, { user: "System", text: `Connection Error: ${error.message}`, type: 'system' }]);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setMessages(prev => [...prev, { user: "System", text: `Disconnected: ${reason}`, type: 'system' }]);
        handleReconnect();
      });

      return () => {
        clearTimeout(reconnectTimer);
        socket.off('connect');
        socket.off('message');
        socket.off('commandResponse');
        socket.off('connect_error');
        socket.off('disconnect');
      };
    }
  }, [socket, reconnect, reconnectAttempts]);

  const sendMessage = () => {
    if (socket && input.trim()) {
      if (isSocketConnected()) {
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

    if (value.startsWith("/")) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  };

  const handleCommandSelect = (command) => {
    setInput(command);
    setShowCommands(false);
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
        onClick={reconnect} 
        className="mt-2 bg-neon-blue text-gray-900 px-4 py-2 rounded hover:bg-neon-yellow transition"
      >
        Manual Reconnect
      </button>
    </div>
  );
};

export default ChatRoom;