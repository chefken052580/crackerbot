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

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const socket = useChatSocket("http://websocket_server:5002"); // Ensure this matches your Docker Compose service name

  useEffect(() => {
    if (socket) {
      // Listen for 'message' event for all incoming messages
      socket.on('message', (data) => {
        setMessages(prev => [...prev, data]);
      });
      
      // Listen for command responses
      socket.on('commandResponse', (response) => {
        setMessages(prev => [...prev, { user: "System", text: response.success ? response.response : `Error: ${response.error}` }]);
      });

      // Error handling for connection issues
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      // Clean up listeners on component unmount
      return () => {
        socket.off('message');
        socket.off('commandResponse');
        socket.off('connect_error');
        socket.off('disconnect');
      };
    }
  }, [socket]);

  const sendMessage = () => {
    if (socket && input.trim()) {
      if (input.startsWith("/")) {
        socket.emit('command', { command: input, user: "Admin", target: "bot_lead" });
      } else {
        socket.emit('message', { type: "message", text: input, user: "Admin" });
      }
      // Add the sent message to the chat immediately
      setMessages(prev => [...prev, { user: "Admin", text: input }]);
      setInput("");
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
        <div className="absolute bg-gray-800 border border-gray-600 rounded-md shadow-md p-2 mt-2">
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
      <div className="flex mt-4">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message or command..."
          className="flex-1 p-2 rounded-l-md bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-neon-yellow"
        />
        <button
          onClick={sendMessage}
          className="bg-neon-green text-gray-900 px-4 py-2 rounded-r-md hover:bg-neon-yellow transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;