import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const commands = [
  { command: "/check_bot_health", description: "Check Bot Health" },
  { command: "/start_task", description: "Start New Task" },
  { command: "/stop_bots", description: "Stop All Bots" },
  { command: "/list_projects", description: "List Active Projects" },
  { command: "/download", description: "Download Last Task File" },
];

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [taskPending, setTaskPending] = useState(null);
  const chatEndRef = useRef(null);

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
      if (data.type === "progress") {
        setMessages((prev) => {
          const updated = prev.filter(msg => msg.type !== "progress" || msg.taskId !== data.taskId);
          return [...updated, { user: data.user, text: data.text, type: data.type, taskId: data.taskId }];
        });
      } else {
        setMessages((prev) => [...prev, { user: data.user || "Bot", text: data.text, type: data.type || "bot" }]);
      }
      if (data.type === "question" && data.taskId) {
        setTaskPending({ taskId: data.taskId, question: data.text });
      }
    });

    newSocket.on("commandResponse", (data) => {
      console.log("Command response:", data);
      if (data.type === "download") {
        setMessages((prev) => [...prev, { user: "Cracker Bot", text: data.response, type: "download", fileName: data.fileName, fileContent: data.content }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { user: data.user || "System", text: data.response, type: data.success ? "success" : "error", fileName: data.fileName, fileContent: data.content }
        ]);
      }
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!socket || !input.trim() || !isConnected) return;

    if (taskPending) {
      console.log("Sending task response:", { taskId: taskPending.taskId, answer: input });
      socket.emit("taskResponse", { taskId: taskPending.taskId, answer: input, user: "Admin" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "user" }]);
      setTaskPending(null);
    } else if (input.startsWith("/")) {
      socket.emit("command", { command: input, user: "Admin", target: "bot_lead" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "command" }]);
    } else {
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

  const handleDownload = (fileName, fileContent) => {
    const blob = new Blob([fileContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 text-gray-300">
      <h2 className="text-2xl font-bold text-neon-yellow mb-4">Cracker Bot Chat Room</h2>
      <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg p-4 bg-gray-800" style={{ maxHeight: '80vh' }}>
        {messages.map((msg, index) => (
          <ChatMessage
            key={index}
            message={msg}
            onDownload={msg.type === "download" || (msg.type === "success" && msg.fileContent) ? () => handleDownload(msg.fileName || `${msg.taskId || 'file'}.html`, msg.fileContent) : null}
          />
        ))}
        <div ref={chatEndRef} />
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
          placeholder={taskPending ? `Answer: ${taskPending.question}` : "Type your message or command..."}
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
        className="mt-2 bg-neon-blue text-gray-900 px-4 py-2 rounded hover:bg-neon-yellow transition"
      >
        Manual Reconnect
      </button>
    </div>
  );
};

export default ChatRoom;