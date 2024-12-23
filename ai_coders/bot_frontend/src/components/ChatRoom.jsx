import React, { useState, useEffect, useRef } from "react";

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
  const websocket = useRef(null);

  useEffect(() => {
    websocket.current = new WebSocket("wss://strong-shark-climbing.ngrok-free.app");

    websocket.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);
    };

    websocket.current.onopen = () => console.log("Connected to WebSocket");
    websocket.current.onclose = () => console.log("Disconnected from WebSocket");

    return () => websocket.current.close();
  }, []);

  const sendMessage = () => {
    if (websocket.current && input.trim()) {
      const message = { user: "Admin", text: input };
      websocket.current.send(JSON.stringify(message));
      setMessages((prev) => [...prev, message]);
      setInput("");
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Show command dropdown if input starts with `/`
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
          <div key={index} className="mb-3">
            <span className="text-neon-green font-semibold">{msg.user}:</span>
            <span className="ml-2">{msg.text}</span>
          </div>
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
