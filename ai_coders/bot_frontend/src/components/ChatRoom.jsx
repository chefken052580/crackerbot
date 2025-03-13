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
    button: "bg-neon-green hover:bg-neon-yellow",
    buttonText: "text-gray-900",
    accent: "text-neon-yellow",
    bubble: "bg-purple-600 hover:bg-yellow-400 text-white font-semibold",
  },
  // ... (other color schemes unchanged)
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
  const [currentTask, setCurrentTask] = useState({});
  const [progressMessage, setProgressMessage] = useState(null); // Single progress message
  const [colorScheme, setColorScheme] = useState(localStorage.getItem('colorScheme') || "neon");
  const [playSound, setPlaySound] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef(null);
  const audioRef = useRef(new Audio('/ping.wav'));
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
        from: data.from,
        user: data.user || "Guest",
        text: data.text,
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
        progress: data.progress, // Include progress if present
      };

      if (data.type === "progress") {
        setProgressMessage((prev) => ({
          ...prev,
          ...newMessage,
          id: data.taskId, // Use taskId to identify this progress message
        }));
        if (data.progress === 100) setTimeout(() => setProgressMessage(null), 2000);
      } else {
        setMessages((prev) => [...prev, newMessage]);
        if (data.type === "question" && data.taskId) {
          setTaskPending({ taskId: data.taskId, question: data.text });
          setCurrentTask((prev) => ({
            ...prev,
            [data.taskId]: {
              ...prev[data.taskId],
              name: data.taskName || prev[data.taskId]?.name,
              type: data.taskType || prev[data.taskId]?.type,
              features: data.taskFeatures || prev[data.taskId]?.features,
              step: data.text.includes("task name") || data.text.includes("call this") ? "name" :
                    data.text.includes("type") || data.text.includes("should this be") ? "type" :
                    data.text.includes("features") || data.text.includes("want in it") ? "features" :
                    data.text.includes("Should we shoot") ? "choice" : prev[data.taskId]?.step || "name"
            }
          }));
        } else if (data.type === "task_response" && data.taskId) {
          setCurrentTask((prev) => {
            const current = prev[data.taskId] || {};
            if (current.step === "name") {
              return { ...prev, [data.taskId]: { ...current, name: data.text, step: "type" } };
            } else if (current.step === "type") {
              return { ...prev, [data.taskId]: { ...current, type: data.text, step: "features" } };
            } else if (current.step === "features") {
              return { ...prev, [data.taskId]: { ...current, features: data.text, step: "building" } };
            }
            return prev;
          });
          setTaskPending(null);
        }
      }

      if (data.user && data.user !== "Guest") {
        localStorage.setItem('userName', data.user);
        console.log("ChatRoom: Updated userName in localStorage:", data.user);
      }
      if (playSound && data.type !== "progress") audioRef.current.play().catch(() => console.log("ChatRoom: Audio play failed"));
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
      socketRef.current.off("connect");
      socketRef.current.off("message");
      socketRef.current.off("typing");
      socketRef.current.off("connect_error");
      socketRef.current.off("disconnect");
      socketRef.current.off("error");
      socketRef.current.disconnect();
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
    if (!socketRef.current || !messageText.trim() || !isConnected) {
      console.warn("ChatRoom: Cannot send message - socket not ready or message empty");
      return;
    }

    console.log("ChatRoom: Sending message:", messageText);
    const userName = localStorage.getItem('userName') || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
    };

    if (taskPending) {
      messageData.type = "task_response";
      messageData.taskId = taskPending.taskId;
      if (taskPending.question.includes("What’s your name")) {
        localStorage.setItem('userName', messageText.trim());
        messageData.user = messageText.trim();
        console.log("ChatRoom: Set userName in localStorage from task response:", messageText.trim());
      }
    } else if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.target = "bot_lead";
    } else {
      messageData.type = "general_message";
    }

    socketRef.current.emit('message', messageData);
    setInput("");
    setShowCommands(false);
    setCommandIndex(-1);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith("/") && !taskPending) {
      const filtered = commands.filter(cmd => cmd.command.startsWith(value.split(' ')[0]));
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setCommandIndex(filtered.length > 0 ? 0 : -1);
    } else {
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (showCommands && commandIndex >= 0) {
        const selectedCommand = filteredCommands[commandIndex].command + " ";
        setInput(selectedCommand);
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
    inputRef.current.focus();
  };

  const toggleRecording = () => {
    if (!isRecording) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognitionRef.current = recognition;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };
      recognition.onerror = (event) => {
        console.error("ChatRoom: Speech recognition error:", event.error);
        setIsRecording(false);
      };
      recognition.start();
      setIsRecording(true);
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  };

  const startVoiceToText = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      console.error("ChatRoom: Voice-to-text error:", event.error);
      setIsRecording(false);
    };
    recognition.onstart = () => setIsRecording(true);
    recognition.start();
  };

  const stopVoiceToText = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      if (input.trim()) {
        sendMessage(input);
      }
    }
  };

  const manualReconnect = () => {
    console.log("ChatRoom: Manual reconnect triggered with reset");
    if (socketRef.current) {
      const userId = socketRef.current.id;
      const ip = window.location.hostname;
      socketRef.current.emit('reset_user', { userId, ip });
      localStorage.removeItem('userName');
      setMessages([]);
      setTaskPending(null);
      setCurrentTask({});
      setProgressMessage(null);
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
      const lines = decoded.split('\n').slice(0, 5).join('\n');
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: `Preview:\n\`\`\`\n${lines}\n\`\`\``, 
        type: "system", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: "Preview failed—binary file!", 
        type: "error", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  };

  const handleColorChange = (scheme) => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
  };

  const toggleSound = () => setPlaySound((prev) => !prev);

  const currentScheme = colorSchemes[colorScheme];

  console.log("ChatRoom: Rendering UI with colorScheme:", colorScheme);

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
            <option value="solarized">Solarized</option>
            <option value="cyberpunk">Cyberpunk</option>
            <option value="forest">Forest</option>
          </select>
          <button
            onClick={toggleSound}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText}`}
          >
            {playSound ? "🔇" : "🔊"}
          </button>
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
              const transcript = messages.map(msg => `${msg.timestamp} ${msg.from}: ${msg.text}`).join('\n');
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
              <div key={user} className={`text-gray-500 italic`}>{`${user} is typing...`}</div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {taskPending && currentTask[taskPending.taskId] && (
            <div className={`text-gray-400 my-2`}>
              Task: {currentTask[taskPending.taskId].name || "Pending"} | 
              Type: {currentTask[taskPending.taskId].type || "Pending"} | 
              Features: {currentTask[taskPending.taskId].features || "Pending"}
            </div>
          )}

          {showCommands && (
            <div 
              ref={commandsRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={`relative ${currentScheme.chatBg} border border-gray-600 rounded-md shadow-md p-2 mt-2 z-10 max-h-40 overflow-y-auto`}
            >
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.command}
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={`cursor-pointer p-2 rounded-md ${idx === commandIndex ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
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
              placeholder={taskPending ? `Answer: ${taskPending.question}` : "Type your message or /command..."}
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-gray-600 ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-${currentScheme.accent.split('-')[1]}`}
            />
            <button
              onMouseDown={startVoiceToText}
              onMouseUp={stopVoiceToText}
              onTouchStart={startVoiceToText}
              onTouchEnd={stopVoiceToText}
              className={`p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? 'scale-110 animate-pulse' : ''}`}
            >
              🎙️
            </button>
            <button
              onClick={() => sendMessage(input)}
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