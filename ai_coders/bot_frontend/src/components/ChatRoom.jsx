import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

const WEBSOCKET_SERVER_URL = process.env.REACT_APP_WEBSOCKET_SERVER_URL || "wss://websocket-visually-sterling-spider.ngrok-free.app";

const commands = [
  { command: "/create", description: "Start a new project" },
  { command: "/projects", description: "List your projects" },
  { command: "/download", description: "Grab your latest file" },
  { command: "/reset_name", description: "Change your name" },
  { command: "/tone", description: "Set my vibe (e.g., /tone sassy)" },
  { command: "/guide", description: "See all commands" },
  { command: "/template", description: "Start with a template (e.g., /template 1)" },
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
    success: "text-neon-green bg-gray-800",
    error: "text-neon-red bg-gray-800",
    question: "text-[#ADD8E6] bg-gray-800",
    progress: "bg-gray-800",
    download: "bg-purple-900 text-purple-200",
    button: "bg-neon-green hover:bg-neon-yellow",
    buttonText: "text-gray-900",
    accent: "text-neon-yellow",
    bubble: "bg-purple-600 hover:bg-yellow-400 text-white font-semibold",
  },
};

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(commands);
  const [commandIndex, setCommandIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState({});
  const [taskPending, setTaskPending] = useState(null);
  const [currentTask, setCurrentTask] = useState(null);
  const [progressMessage, setProgressMessage] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [colorScheme, setColorScheme] = useState(localStorage.getItem('colorScheme') || "neon");
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    console.log("ChatRoom: Mounting component...");

    socketRef.current = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket"],
      path: "/socket.io",
    });

    console.log("ChatRoom: WebSocket initialized with URL:", WEBSOCKET_SERVER_URL);

    socketRef.current.on("connect", () => {
      console.log("ChatRoom: WebSocket connected, ID:", socketRef.current.id);
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: "Connected to WebSocket", 
        type: "system", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
      setIsConnected(true);
      const userName = localStorage.getItem('userName') || "Guest";
      socketRef.current.emit("register", { 
        name: userName,
        role: "frontend", 
        frontendId: socketRef.current.id,
        userName 
      });
      socketRef.current.emit("frontend_connected", { 
        ip: window.location.hostname, 
        frontendId: socketRef.current.id,
        userName 
      });
      console.log("ChatRoom: Emitted 'register' and 'frontend_connected' with ID:", socketRef.current.id, "and userName:", userName);
    });

    socketRef.current.on("message", (data) => {
      console.log("ChatRoom: Message received:", data);
      setIsTyping((prev) => ({ ...prev, [data.from || "Cracker Bot"]: false }));
      const newMessage = {
        from: data.from || "Unknown",
        user: data.user || localStorage.getItem('userName') || "Guest",
        text: data.text || "",
        type: data.type || "bot",
        fileName: data.fileName,
        fileContent: data.content,
        taskId: data.taskId,
        options: data.options,
        timestamp: new Date().toLocaleTimeString(),
        frontendId: data.frontendId,
        taskName: data.taskName,
        taskType: data.taskType,
        taskFeatures: data.taskFeatures,
        progress: data.progress,
        downloadUrl: data.downloadUrl,
      };

      if (data.type === "progress") {
        setProgressMessage(() => ({
          ...newMessage,
          id: data.taskId,
        }));
        if (data.progress === 100) {
          setCurrentTask((prev) => (prev ? { ...prev, status: "building_complete" } : null));
        }
      } else if (data.type === "question" && data.taskId) {
        setMessages((prev) => [...prev, newMessage]);
        setTaskPending({ taskId: data.taskId, question: data.text, options: data.options });
        setCurrentTask((prev) => ({
          taskId: data.taskId,
          name: data.taskName || prev?.name || "Pending",
          type: data.taskType || prev?.type || "Pending",
          features: data.taskFeatures || prev?.features || "Pending",
          step:
            data.text.toLowerCase().includes("name") && !localStorage.getItem('userName') ? "name" :
            data.text.toLowerCase().includes("type") ? "type" :
            data.text.toLowerCase().includes("description") ? "features" :
            data.text.toLowerCase().includes("shoot") ? "choice" : "confirm",
          status: "pending",
        }));
        setEditMode(null);
      } else if (data.type === "success" && data.options) {
        setMessages((prev) => [...prev, newMessage]);
        setTaskPending(null);
        setCurrentTask((prev) => (prev ? { ...prev, step: "choice" } : null));
      } else if (data.type === "download") {
        setMessages((prev) => [...prev, newMessage]);
        setProgressMessage(null);
        setTaskPending(null);
        setCurrentTask((prev) => (prev ? { ...prev, status: "completed", name: data.taskName, type: data.taskType, features: data.taskFeatures } : null));
        setEditMode(data.taskId);
        if (data.downloadUrl) {
          const link = document.createElement("a");
          link.href = data.downloadUrl;
          link.download = data.fileName || `${data.taskName || "unnamed"}.${data.taskType || "txt"}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else if (data.type === "error" && data.taskId) {
        setMessages((prev) => [...prev, newMessage]);
        setProgressMessage(null);
        setTaskPending(null);
        setCurrentTask(null);
        setEditMode(null);
      } else {
        setMessages((prev) => [...prev, newMessage]);
      }

      if (data.user && data.user !== "Guest") {
        localStorage.setItem("userName", data.user);
        console.log("ChatRoom: Updated userName in localStorage:", data.user);
      }
    });

    socketRef.current.on("taskResult", (data) => {
      console.log("ChatRoom: TaskResult received:", data);
      const { taskId, content, fileName, type, name, frontendId } = data;

      let decodedContent;
      try {
        decodedContent = atob(content);
      } catch (e) {
        console.error("ChatRoom: Failed to decode Base64 content:", e);
        setMessages((prev) => [...prev, {
          from: "System",
          text: "Error: Couldn’t decode the file content!",
          type: "error",
          timestamp: new Date().toLocaleTimeString(),
        }]);
        return;
      }

      const blob = new Blob([decodedContent], { type: `text/${type}` });
      const downloadUrl = window.URL.createObjectURL(blob);

      const newMessage = {
        from: "Cracker Bot",
        text: `Yo ${localStorage.getItem("userName") || "Guest"}, your "${name}" is ready! Click to download:`,
        type: "download",
        fileName: fileName,
        downloadUrl: downloadUrl,
        taskId: taskId,
        timestamp: new Date().toLocaleTimeString(),
        frontendId: frontendId,
        taskName: name,
        taskType: type,
      };
      setMessages((prev) => [...prev, newMessage]);
      setProgressMessage(null);
      setTaskPending(null);
      setCurrentTask((prev) => (prev ? { ...prev, status: "completed", name, type } : null));
      setEditMode(taskId);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    socketRef.current.on("typing", (data) => {
      console.log("ChatRoom: Typing event received:", data);
      setIsTyping((prev) => ({ ...prev, [data.target === "bot_frontend" ? "Cracker Bot" : data.user || "Unknown"]: true }));
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("ChatRoom: WebSocket connect error:", error.message);
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: `Connection Error: ${error.message}`, 
        type: "error", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
      setIsConnected(false);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("ChatRoom: WebSocket disconnected:", reason);
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: `Disconnected: ${reason}`, 
        type: "error", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
      setIsConnected(false);
    });

    socketRef.current.on("error", (error) => {
      console.error("ChatRoom: WebSocket error:", error);
    });

    console.log("ChatRoom: WebSocket setup complete");

    return () => {
      console.log("ChatRoom: Unmounting, cleaning up WebSocket");
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("message");
        socketRef.current.off("taskResult");
        socketRef.current.off("typing");
        socketRef.current.off("connect_error");
        socketRef.current.off("disconnect");
        socketRef.current.off("error");
        socketRef.current.disconnect();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    console.log("ChatRoom: Scrolling to end due to messages or typing change");
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, progressMessage]);

  useEffect(() => {
    if (showCommands && commandsRef.current) {
      console.log("ChatRoom: Focusing commands dropdown");
      commandsRef.current.focus();
    }
  }, [showCommands, filteredCommands]);

  const sendMessage = (messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected || isSending) {
      console.warn("ChatRoom: Cannot send message", {
        socketExists: !!socketRef.current,
        messageText,
        isConnected,
        isSending,
      });
      return;
    }

    setIsSending(true);
    console.log("ChatRoom: Sending message:", messageText);
    const userName = localStorage.getItem("userName") || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
    };

    if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.target = "bot_lead";
      const commandParts = messageText.split(" ");
      const command = commandParts[0].toLowerCase();

      switch (command) {
        case "/create":
          messageData.text = "Build something epic!";
          break;
        case "/projects":
          // Placeholder; server should handle listing projects
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            text: "Project listing not yet implemented. Use /create to start a new one!",
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          return;
        case "/download":
          // Placeholder; server should handle latest download
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            text: "Download latest not yet implemented server-side. Complete a task to download!",
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          return;
        case "/reset_name":
          localStorage.removeItem("userName");
          socketRef.current.emit("reset_user", { userId: socketRef.current.id, ip: window.location.hostname });
          setMessages((prev) => [...prev, {
            from: "System",
            text: "Name reset! Please enter a new name.",
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setCurrentTask({ taskId: `initial_name:${socketRef.current.id}`, step: "name", status: "pending" });
          setIsSending(false);
          return;
        case "/tone":
          const tone = commandParts[1] || "default";
          messageData.text = `/tone ${tone}`;
          break;
        case "/guide":
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            text: "Available commands:\n" + commands.map(cmd => `${cmd.command}: ${cmd.description}`).join("\n"),
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          return;
        case "/template":
          const templateNum = commandParts[1] || "1";
          messageData.text = `/template ${templateNum}`;
          break;
        default:
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            text: `Unknown command: ${command}. Try /guide for help!`,
            type: "error",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          return;
      }
    } else if (currentTask && currentTask.status !== "completed") {
      messageData.type = "task_response";
      messageData.taskId = currentTask.taskId;
      if (currentTask.step === "name" && !localStorage.getItem("userName")) {
        localStorage.setItem("userName", messageText.trim());
        messageData.user = messageText.trim();
        console.log("ChatRoom: Set userName in localStorage from task response:", messageText.trim());
        setCurrentTask((prev) => ({ ...prev, step: "choice" }));
      } else if (currentTask.step === "choice") {
        if (messageText.toLowerCase().includes("build")) {
          setCurrentTask((prev) => ({ ...prev, step: "project_name" }));
        } else if (messageText.toLowerCase().includes("shoot")) {
          setCurrentTask((prev) => ({ ...prev, step: "chat" }));
        }
      } else if (currentTask.step === "project_name") {
        setCurrentTask((prev) => ({ ...prev, name: messageText, step: "type" }));
      } else if (currentTask.step === "type") {
        setCurrentTask((prev) => ({ ...prev, type: messageText, step: "features" }));
      } else if (currentTask.step === "features") {
        setCurrentTask((prev) => ({ ...prev, features: messageText, step: "confirm" }));
      } else if (currentTask.step === "confirm" && messageText.toLowerCase() === "create file / project") {
        setCurrentTask((prev) => ({ ...prev, status: "building" }));
      }
    } else {
      messageData.type = "general_message";
    }

    socketRef.current.emit("message", messageData);
    setInput("");
    setShowCommands(false);
    setCommandIndex(-1);
    setTimeout(() => setIsSending(false), 1000);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith("/") && !currentTask) {
      const query = value.split(" ")[0].toLowerCase();
      const filtered = commands.filter((cmd) => cmd.command.toLowerCase().startsWith(query));
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setCommandIndex(filtered.length > 0 ? 0 : -1);
    } else {
      setShowCommands(false);
      setCommandIndex(-1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (showCommands && commandIndex >= 0) {
        const selectedCommand = filteredCommands[commandIndex].command + " ";
        setInput(selectedCommand);
        setShowCommands(false);
        setCommandIndex(-1);
      } else {
        sendMessage(input);
      }
    } else if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCommandIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      }
    }
  };

  const handleCommandSelect = (command) => {
    setInput(command + " ");
    setShowCommands(false);
    setCommandIndex(-1);
    inputRef.current?.focus();
  };

  const toggleRecording = () => {
    if (!isRecording) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error("ChatRoom: SpeechRecognition not supported in this browser.");
        setMessages((prev) => [...prev, {
          from: "System",
          text: "Speech recognition not supported in this browser!",
          type: "error",
          timestamp: new Date().toLocaleTimeString(),
        }]);
        return;
      }
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        sendMessage(transcript);
      };
      recognition.onerror = (event) => {
        console.error("ChatRoom: Speech recognition error:", event.error);
        setMessages((prev) => [...prev, {
          from: "System",
          text: `Speech recognition error: ${event.error}`,
          type: "error",
          timestamp: new Date().toLocaleTimeString(),
        }]);
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognition.start();
      setIsRecording(true);
      console.log("ChatRoom: Started speech recognition");
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
      console.log("ChatRoom: Stopped speech recognition");
    }
  };

  const manualReconnect = () => {
    console.log("ChatRoom: Manual reconnect triggered with reset");
    if (socketRef.current) {
      const userId = socketRef.current.id;
      const ip = window.location.hostname;
      socketRef.current.emit("reset_user", { userId, ip });
      localStorage.removeItem("userName");
      setMessages([]);
      setTaskPending(null);
      setCurrentTask(null);
      setProgressMessage(null);
      setEditMode(null);
      socketRef.current.disconnect();
      socketRef.current.connect();
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: "Reset and reconnected", 
        type: "system", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  };

  const handlePreview = (fileContent) => {
    try {
      const decoded = atob(fileContent);
      const lines = decoded.split("\n").slice(0, 5).join("\n");
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: `Preview:\n\`\`\`\n${lines}\n\`\`\``, 
        type: "system", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: "Preview failed—binary file or invalid content!",
        type: "error", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  };

  const handleColorChange = (scheme) => {
    setColorScheme(scheme);
    localStorage.setItem("colorScheme", scheme);
  };

  const currentScheme = colorSchemes[colorScheme];

  console.log("ChatRoom: Rendering UI with colorScheme:", colorScheme);

  return (
    <div className={`flex flex-col h-full ${currentScheme.bg} ${currentScheme.text}`}>
      <div className="flex-shrink-0 p-4 flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${currentScheme.accent}`}>
          Cracker Bot Chat Room {editMode ? "(Edit Mode)" : ""}
        </h2>
        <div className="flex space-x-2">
          <select
            value={colorScheme}
            onChange={(e) => handleColorChange(e.target.value)}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            <option value="neon">Neon</option>
          </select>
          <button
            onClick={toggleRecording}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            {isRecording ? "🎙️" : "🎤"}
          </button>
          <button
            onClick={manualReconnect}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            Reconnect
          </button>
          <button
            onClick={() => {
              const transcript = messages.map((msg) => `${msg.timestamp} ${msg.from}: ${msg.text}`).join("\n");
              const blob = new Blob([transcript], { type: "text/plain" });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `chat_transcript_${new Date().toISOString().replace(/:/g, "-")}.txt`;
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
        <div className={`w-full max-w-3xl flex flex-col h-[80vh] max-h-[80vh] mx-4 ${editMode ? "border-2 border-neon-yellow" : ""}`}>
          <div className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto`}>
            {messages.filter((msg) => msg.type !== "progress" || (msg.type === "progress" && msg.progress < 100)).map((msg, index) => (
              <div key={index}>
                <ChatMessage
                  message={msg}
                  onPreview={msg.fileContent ? () => handlePreview(msg.fileContent) : null}
                  onOptionClick={(option) => sendMessage(option)}
                  colorScheme={currentScheme}
                />
              </div>
            ))}
            {progressMessage && (
              <div>
                <ChatMessage
                  message={progressMessage}
                  colorScheme={currentScheme}
                />
              </div>
            )}
            {Object.entries(isTyping).map(([user, typing]) => typing && (
              <div key={user} className="text-gray-500 italic">{`${user} is typing...`}</div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {currentTask && (
            <div className="text-gray-400 my-2">
              Task: {currentTask.name} | Type: {currentTask.type} | Features: {currentTask.features || "Pending"}
            </div>
          )}

          {showCommands && (
            <div 
              ref={commandsRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={`absolute ${currentScheme.chatBg} border border-gray-600 rounded-md shadow-md p-2 mt-2 z-10 max-h-40 overflow-y-auto`}
            >
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.command}
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={`cursor-pointer p-2 rounded-md ${idx === commandIndex ? "bg-gray-600" : "hover:bg-gray-700"}`}
                >
                  <span className={`${currentScheme.accent} font-bold`}>{cmd.command}</span> - {cmd.description}
                </div>
              ))}
            </div>
          )}

          <div className="flex mt-2 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={taskPending ? `Answer: ${taskPending.question}` : editMode ? "Edit or add more..." : "Type your message or /command..."}
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-gray-600 ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-${currentScheme.accent.split("-")[1]}`}
            />
            <button
              onClick={toggleRecording}
              className={`p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? "scale-110 animate-pulse" : ""}`}
            >
              🎙️
            </button>
            <button
              onClick={() => {
                console.log("ChatRoom: Send button clicked, input:", input);
                sendMessage(input);
              }}
              disabled={!isConnected || !input.trim() || isSending}
              className={`px-4 py-2 rounded-r-md transition ${isConnected && input.trim() && !isSending ? `${currentScheme.button} ${currentScheme.buttonText}` : "bg-gray-500 text-gray-300 cursor-not-allowed"}`}
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