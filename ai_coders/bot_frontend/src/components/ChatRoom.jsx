import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const commands = [
  { command: "/list_bot_health", description: "List Bot Health" },
  { command: "/show_bot_tasks", description: "Show Bot Tasks" },
  { command: "/start_task", description: "Start New Task" },
  { command: "/stop_bots", description: "Stop All Bots" },
  { command: "/list_projects", description: "List All Projects" },
  { command: "/build <task>", description: "Delegate a software build task" },
];

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [taskPending, setTaskPending] = useState(null); // Track task questions from bot_lead

  useEffect(() => {
    const newSocket = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket"],
      path: "/socket.io",
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected, ID:", newSocket.id);
      setMessages((prev) => [...prev, { user: "System", text: "Connected to WebSocket", type: "system" }]);
      setIsConnected(true);
      newSocket.emit("register", { name: "bot_frontend", role: "frontend" });
    });

    newSocket.on("message", (data) => {
      console.log("Received message:", data);
      setMessages((prev) => [...prev, { user: data.user || "Bot", text: data.text, type: data.type || "bot" }]);
      if (data.type === "question") setTaskPending({ taskId: data.taskId, question: data.text });
    });

    newSocket.on("commandResponse", (response) => {
      console.log("Command response:", response);
      setMessages((prev) => [
        ...prev,
        {
          user: response.user || "System",
          text: response.success ? response.response : `Error: ${response.error || "Unknown error"}`,
          type: response.success ? "success" : "error",
        },
      ]);
    });

    newSocket.on("response", (data) => {
      console.log("Response:", data);
      setMessages((prev) => [
        ...prev,
        {
          user: data.user || "Bot",
          text: data.success ? data.response : `Error: ${data.error || "Unknown error"}`,
          type: data.success ? "success" : "error",
        },
      ]);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connect error:", error);
      setMessages((prev) => [...prev, { user: "System", text: `Connection Error: ${error.message}`, type: "error" }]);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setMessages((prev) => [...prev, { user: "System", text: `Disconnected: ${reason}`, type: "error" }]);
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
      console.log("Socket cleanup");
    };
  }, []);

  const sendMessage = () => {
    if (!socket || !input.trim() || !isConnected) return;

    if (taskPending) {
      // Answer a task question
      socket.emit("taskResponse", { taskId: taskPending.taskId, answer: input });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "user" }]);
      setTaskPending(null);
    } else if (input.startsWith("/")) {
      // Send a command
      socket.emit("command", { command: input, user: "Admin", target: "bot_lead" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "command" }]);
    } else {
      // Send a manual message
      socket.emit("message", { text: input, user: "Admin" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "user" }]);
    }
    setInput("");
    setShowCommands(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setShowCommands(value.startsWith("/") && !taskPending);
  };

  const handleCommandSelect = (command) => {
    setInput(command);
    setShowCommands(false);
  };

  const manualReconnect = () => {
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 text-gray-300">
      <h2 className="text-2xl font-bold text-neon-yellow mb-4">Bot Chat Room</h2>
      <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg p-4 bg-gray-800">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded ${
              msg.type === "system" ? "text-gray-400" :
              msg.type === "command" ? "text-neon-blue font-bold" :
              msg.type === "success" ? "text-neon-green" :
              msg.type === "error" ? "text-red-500" :
              msg.type === "question" ? "text-yellow-400 font-semibold" :
              msg.type === "bot" ? "text-neon-purple" : "text-white"
            }`}
          >
            <span className="font-semibold">{msg.user}: </span>{msg.text}
          </div>
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
          placeholder={taskPending ? `${taskPending.question}` : "Type your message or command..."}
          className="flex-1 p-2 rounded-l-md bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-neon-yellow"
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
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
        className="mt-2 bg-neon-blue text-gray