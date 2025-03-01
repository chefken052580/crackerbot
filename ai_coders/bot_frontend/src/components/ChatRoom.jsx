import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const socket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ["websocket"],
  path: "/socket.io",
});

const commands = [
  { command: "/check_bot_health", description: "Check Bot Health" },
  { command: "/start_task", description: "Start New Task" },
  { command: "/stop_bots", description: "Stop All Bots" },
  { command: "/list_projects", description: "List Active Projects" },
  { command: "/download", description: "Download Last Task File" },
  { command: "/templates", description: "List Project Templates" },
];

const colorSchemes = {
  neon: {
    bg: "bg-gray-900",
    chatBg: "bg-gray-800",
    text: "text-gray-300",
    user: "text-neon-yellow bg-gray-700",
    bot: "text-neon-green bg-gray-800",
    system: "text-neon-blue bg-gray-900 italic",
    command: "text-neon-purple bg-gray-700",
    success: "text-neon-cyan bg-gray-800",
    error: "text-neon-red bg-gray-800",
    question: "text-[#ADD8E6] bg-gray-800",
    progress: "bg-gray-800",
    button: "bg-neon-green hover:bg-neon-yellow",
    buttonText: "text-gray-900",
    accent: "text-neon-yellow",
  },
  pastel: {
    bg: "bg-gray-100",
    chatBg: "bg-white",
    text: "text-gray-800",
    user: "text-pink-500 bg-pink-100",
    bot: "text-blue-500 bg-blue-100",
    system: "text-purple-500 bg-purple-100 italic",
    command: "text-indigo-500 bg-indigo-100",
    success: "text-green-500 bg-gray-100",
    error: "text-red-500 bg-gray-100",
    question: "text-teal-500 bg-teal-100",
    progress: "bg-white",
    button: "bg-blue-400 hover:bg-blue-500",
    buttonText: "text-white",
    accent: "text-pink-500",
  },
  darkMetal: {
    bg: "bg-gray-800",
    chatBg: "bg-gray-700",
    text: "text-gray-200",
    user: "text-orange-400 bg-gray-600",
    bot: "text-green-400 bg-gray-700",
    system: "text-blue-400 bg-gray-800 italic",
    command: "text-violet-400 bg-gray-600",
    success: "text-teal-400 bg-gray-700",
    error: "text-red-400 bg-gray-700",
    question: "text-cyan-400 bg-gray-700",
    progress: "bg-gray-700",
    button: "bg-green-500 hover:bg-green-600",
    buttonText: "text-gray-900",
    accent: "text-orange-400",
  },
  retro: {
    bg: "bg-black",
    chatBg: "bg-gray-900",
    text: "text-white",
    user: "text-yellow-300 bg-gray-800",
    bot: "text-green-300 bg-gray-900",
    system: "text-blue-300 bg-black italic",
    command: "text-magenta-300 bg-gray-800",
    success: "text-cyan-300 bg-gray-900",
    error: "text-red-300 bg-gray-900",
    question: "text-purple-300 bg-gray-900",
    progress: "bg-gray-900",
    button: "bg-green-600 hover:bg-green-700",
    buttonText: "text-white",
    accent: "text-yellow-300",
  },
};

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isTyping, setIsTyping] = useState({});
  const [taskPending, setTaskPending] = useState(null);
  const [currentTask, setCurrentTask] = useState(null);
  const [colorScheme, setColorScheme] = useState(localStorage.getItem('colorScheme') || "neon");
  const [playSound, setPlaySound] = useState(true);
  const chatEndRef = useRef(null);
  const audioRef = useRef(new Audio('/ping.wav'));

  useEffect(() => {
    console.log("ChatRoom mounted, setting up WebSocket");

    socket.on("connect", () => {
      console.log("WebSocket connected, ID:", socket.id);
      setMessages((prev) => [...prev, { user: "System", text: "Connected to WebSocket", type: "system", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(true);
      socket.emit("register", { name: "bot_frontend", role: "frontend" });
    });

    socket.on("message", (data) => {
      console.log("Message received:", data);
      setIsTyping((prev) => ({ ...prev, [data.user || "Cracker Bot"]: false }));
      const newMessage = { user: data.user || "Cracker Bot", text: data.text, type: data.type || "bot", timestamp: new Date().toLocaleTimeString() };
      if (data.type === "progress") {
        setMessages((prev) => {
          const updated = prev.filter((msg) => msg.type !== "progress" || msg.taskId !== data.taskId);
          return [...updated, { ...newMessage, taskId: data.taskId }];
        });
      } else {
        setMessages((prev) => [...prev, newMessage]);
      }
      if (data.type === "question" && data.taskId) {
        setTaskPending({ taskId: data.taskId, question: data.text });
        setCurrentTask((prev) => ({
          ...prev,
          [data.taskId]: { ...(prev?.[data.taskId] || {}), step: data.text.includes("task name") ? "name" : data.text.includes("type") ? "type" : "features" },
        }));
      }
      if (playSound) audioRef.current.play().catch(() => console.log("Audio play failed"));
    });

    socket.on("commandResponse", (data) => {
      console.log("Command response received:", data);
      setIsTyping((prev) => ({ ...prev, "Cracker Bot": false }));
      const newMessage = { user: "Cracker Bot", text: data.response, type: data.type, fileName: data.fileName, fileContent: data.content, timestamp: new Date().toLocaleTimeString() };
      setMessages((prev) => [...prev, newMessage]);
      if (playSound) audioRef.current.play().catch(() => console.log("Audio play failed"));
    });

    socket.on("typing", (data) => {
      console.log("Typing event:", data);
      setIsTyping((prev) => ({ ...prev, [data.target === "bot_frontend" ? "Cracker Bot" : data.user || "Unknown"]: true }));
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connect error:", error.message);
      setMessages((prev) => [...prev, { user: "System", text: `Connection Error: ${error.message}`, type: "error", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      setMessages((prev) => [...prev, { user: "System", text: `Disconnected: ${reason}`, type: "error", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(false);
    });

    if (!socket.connected) {
      console.log("Socket not connected, attempting to connect");
      socket.connect();
    }

    return () => {
      console.log("ChatRoom unmounting, cleaning up WebSocket");
      socket.off("connect");
      socket.off("message");
      socket.off("commandResponse");
      socket.off("typing");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = () => {
    if (!socket || !input.trim() || !isConnected) return;

    console.log("Sending message:", input);
    if (taskPending) {
      socket.emit("taskResponse", { taskId: taskPending.taskId, answer: input, user: "Admin" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "user", timestamp: new Date().toLocaleTimeString() }]);
      setCurrentTask((prev) => ({
        ...prev,
        [taskPending.taskId]: {
          ...prev[taskPending.taskId],
          [taskPending.question.includes("task name") ? "name" : taskPending.question.includes("type") ? "type" : "features"]: input,
        },
      }));
      setTaskPending(null);
    } else if (input.startsWith("/")) {
      socket.emit("command", { command: input, user: "Admin", target: "bot_lead" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "command", timestamp: new Date().toLocaleTimeString() }]);
    } else {
      socket.emit("message", { text: input, user: "Admin" });
      setMessages((prev) => [...prev, { user: "Admin", text: input, type: "user", timestamp: new Date().toLocaleTimeString() }]);
      const recentMessages = messages.slice(-2).concat({ text: input });
      if (!recentMessages.some((msg) => msg.text.toLowerCase().includes("task") || msg.text.toLowerCase().includes("build"))) {
        setTimeout(() => {
          setMessages((prev) => [...prev, { user: "Cracker Bot", text: "Ready to create? Try '/start_task' or '/templates'!", type: "bot", timestamp: new Date().toLocaleTimeString() }]);
        }, 1000);
      }
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
    console.log("Manual reconnect triggered");
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  };

  const handlePreview = (fileContent) => {
    try {
      const decoded = atob(fileContent);
      const lines = decoded.split('\n').slice(0, 5).join('\n');
      setMessages((prev) => [...prev, { user: "System", text: `Preview:\n\`\`\`\n${lines}\n\`\`\``, type: "system", timestamp: new Date().toLocaleTimeString() }]);
    } catch (e) {
      setMessages((prev) => [...prev, { user: "System", text: "Preview failed—binary file!", type: "error", timestamp: new Date().toLocaleTimeString() }]);
    }
  };

  const handleColorChange = (scheme) => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
  };

  const toggleSound = () => setPlaySound((prev) => !prev);

  const currentScheme = colorSchemes[colorScheme];

  return (
    <div className={`flex flex-col h-full ${currentScheme.bg} ${currentScheme.text}`}>
      <div className="flex-shrink-0 p-4 flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${currentScheme.accent}`}>Cracker Bot Chat Room</h2>
        <div className="flex space-x-2">
          <select
            value={colorScheme}
            onChange={(e) => handleColorChange(e.target.value)}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            <option value="neon">Neon</option>
            <option value="pastel">Pastel</option>
            <option value="darkMetal">Dark Metal</option>
            <option value="retro">Retro</option>
          </select>
          <button
            onClick={toggleSound}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            {playSound ? "Mute" : "Unmute"}
          </button>
          <button
            onClick={manualReconnect}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            Reconnect
          </button>
          <button
            onClick={() => {
              const transcript = messages.map(msg => `${msg.timestamp} ${msg.user}: ${msg.text}`).join('\n');
              const blob = new Blob([transcript], { type: 'text/plain' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `chat_transcript_${new Date().toISOString().replace(/:/g, '-')}.txt`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            Download Transcript
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className={`w-full max-w-3xl flex flex-col h-[80vh] max-h-[80vh] mx-4`}>
          <div className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto`}>
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg}
                onDownload={msg.type === "download" || (msg.type === "success" && msg.fileContent) ? () => console.log("Download not implemented yet") : null}
                onPreview={msg.fileContent ? () => handlePreview(msg.fileContent) : null}
                colorScheme={currentScheme}
              />
            ))}
            {Object.entries(isTyping).map(([user, typing]) => typing && (
              <div key={user} className={`text-gray-500 italic`}>{`${user} is typing...`}</div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {currentTask && taskPending && (
            <div className={`text-gray-400 my-2`}>
              Task: {currentTask[taskPending.taskId]?.name || "Pending"} | Type: {currentTask[taskPending.taskId]?.type || "Pending"} | Features: {currentTask[taskPending.taskId]?.features || "Pending"}
            </div>
          )}

          {showCommands && (
            <div className={`relative ${currentScheme.chatBg} border border-gray-600 rounded-md shadow-md p-2 mt-2 z-10`}>
              {commands.map((cmd) => (
                <div
                  key={cmd.command}
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={`cursor-pointer p-2 hover:bg-gray-700 rounded-md`}
                >
                  <span className={`${currentScheme.accent} font-bold`}>{cmd.command}</span> - {cmd.description}
                </div>
              ))}
            </div>
          )}

          <div className="flex mt-2 relative">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={taskPending ? `Answer: ${taskPending.question}` : "Type your message, task name, or /command..."}
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-gray-600 ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-${currentScheme.accent.split('-')[1]}`}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className={`${currentScheme.button} ${currentScheme.buttonText} px-4 py-2 rounded-r-md transition`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;