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
  const { socket, reconnect, isSocketConnected } = useChatSocket("ws://localhost:5003");

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
        console.log('[Frontend] Received command response:', response);
        setMessages(prev => [...prev, { 
          user: "System", 
          text: response.message || JSON.stringify(response),
          type: response.error ? 'error' : 'system'
        }]);
      });

      socket.on('taskUpdate', (update) => {
        console.log('[Frontend] Received task update:', update);
        setMessages(prev => [...prev, {
          user: "Bot",
          text: `Task Update: ${update.status} - ${update.message}`,
          type: 'update'
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
        socket.off('taskUpdate');
        socket.off('connect_error');
        socket.off('disconnect');
      };
    }
  }, [socket, reconnect, reconnectAttempts]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    console.log('[Frontend] Sending message:', input);
    
    // Check if it's a command
    if (input.startsWith('/')) {
      console.log('[Frontend] Command detected:', input);
      const command = input.split(' ')[0];
      const params = input.slice(command.length).trim();
      
      // Add message to chat
      setMessages(prev => [...prev, { user: "You", text: input, type: 'command' }]);
      
      // Send command to socket
      if (socket) {
        console.log('[Frontend] Emitting command to socket:', { command, params });
        socket.emit('command', { command, params });
      } else {
        console.error('[Frontend] Socket not connected');
        setMessages(prev => [...prev, { user: "System", text: "Not connected to server", type: 'error' }]);
      }
    } else {
      // Regular message handling
      console.log('[Frontend] Regular message:', input);
      setMessages(prev => [...prev, { user: "You", text: input, type: 'message' }]);
      socket?.emit('message', { text: input });
    }

    setInput("");
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
      <div className="flex-1 overflow-y-scroll max-h-96 border border-gray-700 rounded-lg p-4 bg-gray-800">
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
        <form onSubmit={handleSubmit} className="flex w-full">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message or command..."
            className="flex-1 p-2 rounded-l-md bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-neon-yellow"
          />
          <button
            type="submit"
            className="bg-neon-green text-gray-900 px-4 py-2 rounded-r-md hover:bg-neon-yellow transition"
          >
            Send
          </button>
        </form>
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