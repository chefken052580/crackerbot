import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const commands = [
  { command: "/create", description: "Start a new project" },
  { command: "/projects", description: "List your projects" },
  { command: "/vibe_check", description: "Check my vibe" },
  { command: "/chill", description: "Take a breather" },
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
    bubble: "bg-neon-purple hover:bg-neon-yellow text-gray-900",
  },
  pastel: {
    bg: "bg-gray-100",
    chatBg: "bg-white",
    text: "text-gray-800",
    user: "text-pink-500 bg-pink-100",
    bot: "text-blue-500 bg-blue-100",
    system: "text-purple-500 bg-purple-100 italic",
    command: "text-indigo-500 bg-indigo-100",
    success: "text-blue-500 bg-blue-100",
    error: "text-red-500 bg-gray-100",
    question: "text-teal-500 bg-teal-100",
    progress: "bg-white",
    button: "bg-blue-400 hover:bg-blue-500",
    buttonText: "text-white",
    accent: "text-pink-500",
    bubble: "bg-indigo-200 hover:bg-indigo-300 text-indigo-800",
  },
  darkMetal: {
    bg: "bg-gray-800",
    chatBg: "bg-gray-700",
    text: "text-gray-200",
    user: "text-orange-400 bg-gray-600",
    bot: "text-green-400 bg-gray-700",
    system: "text-blue-400 bg-gray-800 italic",
    command: "text-violet-400 bg-gray-600",
    success: "text-green-400 bg-gray-700",
    error: "text-red-400 bg-gray-700",
    question: "text-cyan-400 bg-gray-700",
    progress: "bg-gray-700",
    button: "bg-green-500 hover:bg-green-600",
    buttonText: "text-gray-900",
    accent: "text-orange-400",
    bubble: "bg-violet-500 hover:bg-violet-600 text-gray-200",
  },
  retro: {
    bg: "bg-black",
    chatBg: "bg-gray-900",
    text: "text-white",
    user: "text-yellow-300 bg-gray-800",
    bot: "text-green-300 bg-gray-900",
    system: "text-blue-300 bg-black italic",
    command: "text-magenta-300 bg-gray-800",
    success: "text-green-300 bg-gray-900",
    error: "text-red-300 bg-gray-900",
    question: "text-purple-300 bg-gray-900",
    progress: "bg-gray-900",
    button: "bg-green-600 hover:bg-green-700",
    buttonText: "text-white",
    accent: "text-yellow-300",
    bubble: "bg-magenta-400 hover:bg-magenta-500 text-black",
  },
  solarized: {
    bg: "bg-[#002b36]",
    chatBg: "bg-[#073642]",
    text: "text-[#839496]",
    user: "text-[#b58900] bg-[#073642]",
    bot: "text-[#2aa198] bg-[#073642]",
    system: "text-[#6c71c4] bg-[#002b36] italic",
    command: "text-[#d33682] bg-[#073642]",
    success: "text-[#2aa198] bg-[#073642]",
    error: "text-[#cb4b16] bg-[#073642]",
    question: "text-[#268bd2] bg-[#073642]",
    progress: "bg-[#073642]",
    button: "bg-[#2aa198] hover:bg-[#859900]",
    buttonText: "text-[#002b36]",
    accent: "text-[#b58900]",
    bubble: "bg-[#d33682] hover:bg-[#dc322f] text-[#002b36]",
  },
  cyberpunk: {
    bg: "bg-[#0d0c1d]",
    chatBg: "bg-[#1a1a3d]",
    text: "text-[#a0a0ff]",
    user: "text-[#ff00ff] bg-[#1a1a3d]",
    bot: "text-[#00ffff] bg-[#1a1a3d]",
    system: "text-[#ffaa00] bg-[#0d0c1d] italic",
    command: "text-[#ff007f] bg-[#1a1a3d]",
    success: "text-[#00ffff] bg-[#1a1a3d]",
    error: "text-[#ff3333] bg-[#1a1a3d]",
    question: "text-[#00ccff] bg-[#1a1a3d]",
    progress: "bg-[#1a1a3d]",
    button: "bg-[#ff00ff] hover:bg-[#00ffff]",
    buttonText: "text-[#0d0c1d]",
    accent: "text-[#ffaa00]",
    bubble: "bg-[#ff007f] hover:bg-[#ff00ff] text-[#0d0c1d]",
  },
  forest: {
    bg: "bg-[#1a2f27]",
    chatBg: "bg-[#2f4538]",
    text: "text-[#d9e0c7]",
    user: "text-[#e0c589] bg-[#2f4538]",
    bot: "text-[#8ab573] bg-[#2f4538]",
    system: "text-[#b58973] bg-[#1a2f27] italic",
    command: "text-[#d9a773] bg-[#2f4538]",
    success: "text-[#8ab573] bg-[#2f4538]",
    error: "text-[#d97373] bg-[#2f4538]",
    question: "text-[#a7d973] bg-[#2f4538]",
    progress: "bg-[#2f4538]",
    button: "bg-[#8ab573] hover:bg-[#73d9a7]",
    buttonText: "text-[#1a2f27]",
    accent: "text-[#e0c589]",
    bubble: "bg-[#d9a773] hover:bg-[#e0c589] text-[#1a2f27]",
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
  const [currentTask, setCurrentTask] = useState({});
  const [progressMessage, setProgressMessage] = useState(null);
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
    console.log("ChatRoom mounted, setting up WebSocket");

    socketRef.current = io(WEBSOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket"],
      path: "/socket.io",
    });

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected, ID:", socketRef.current.id);
      setMessages((prev) => [...prev, { from: "System", text: "Connected to WebSocket", type: "system", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(true);
      const userName = localStorage.getItem('userName') || "Guest";
      socketRef.current.emit("register", { name: "bot_frontend", role: "frontend", userId: socketRef.current.id, userName });
      socketRef.current.emit("frontend_connected", { ip: window.location.hostname, frontendId: socketRef.current.id });
    });

    socketRef.current.on("message", (data) => {
      console.log("Message received:", data);
      setIsTyping((prev) => ({ ...prev, [data.from || "Cracker Bot"]: false }));
      const newMessage = {
        from: data.from,
        user: data.user || "Admin",
        text: data.text,
        type: data.type || "bot",
        fileName: data.fileName,
        fileContent: data.content,
        taskId: data.taskId,
        options: data.options,
        timestamp: new Date().toLocaleTimeString(),
      };

      if (data.type === "progress") {
        setProgressMessage(newMessage);
        if (data.progress === 100) setTimeout(() => setProgressMessage(null), 2000);
      } else {
        setMessages((prev) => [...prev, newMessage]);
        if (data.type === "question" && data.taskId) {
          setTaskPending({ taskId: data.taskId, question: data.text });
          setCurrentTask((prev) => {
            const current = prev[data.taskId] || {};
            if (data.text.includes("task name") || data.text.includes("thing called")) {
              return { ...prev, [data.taskId]: { ...current, step: "name" } };
            } else if (data.text.includes("type") || data.text.includes("gonna be")) {
              return { ...prev, [data.taskId]: { ...current, step: "type" } };
            } else if (data.text.includes("features") || data.text.includes("ya want")) {
              return { ...prev, [data.taskId]: { ...current, step: "features" } };
            } else if (data.text.includes("network")) {
              return { ...prev, [data.taskId]: { ...current, step: "network-or-features" } };
            } else if (data.text.includes("edit") || data.text.includes("spin")) {
              return { ...prev, [data.taskId]: { ...current, step: "edit" } };
            } else if (data.text.includes("What’s your name") || data.text.includes("name?")) {
              return { ...prev, [data.taskId]: { ...current, step: "name" } };
            }
            return prev;
          });
        } else if (data.type === "task_response" && data.taskId) {
          setCurrentTask((prev) => {
            const current = prev[data.taskId] || {};
            if (current.step === "name" && !data.text.includes("What’s your name") && !data.text.includes("name?")) {
              localStorage.setItem('userName', data.text.trim());
              return { ...prev, [data.taskId]: { ...current, name: data.text, step: "complete" } };
            } else if (current.step === "type") {
              return { ...prev, [data.taskId]: { ...current, type: data.text, step: data.text.toLowerCase() === 'full-stack' ? "network-or-features" : "features" } };
            } else if (current.step === "network-or-features") {
              const choice = data.text.toLowerCase();
              if (choice === 'network') {
                return { ...prev, [data.taskId]: { ...current, step: "network" } };
              } else {
                return { ...prev, [data.taskId]: { ...current, step: "features" } };
              }
            } else if (current.step === "network") {
              return { ...prev, [data.taskId]: { ...current, network: data.text, step: "features" } };
            } else if (current.step === "features") {
              return { ...prev, [data.taskId]: { ...current, features: data.text, step: "building" } };
            } else if (current.step === "edit") {
              return { ...prev, [data.taskId]: { ...current, editRequest: data.text, step: "building" } };
            }
            return prev;
          });
          if (data.text.match(/\d+%/) && parseInt(data.text.match(/\d+%/)[0]) === 100) {
            setProgressMessage(null);
          }
        }
      }

      if (data.user && data.user !== "Cracker Bot" && data.user !== "System") {
        localStorage.setItem('userName', data.user);
      }
      if (playSound) audioRef.current.play().catch(() => console.log("Audio play failed"));
    });

    socketRef.current.on("typing", (data) => {
      console.log("Typing event:", data);
      setIsTyping((prev) => ({ ...prev, [data.target === "bot_frontend" ? "Cracker Bot" : data.user || "Unknown"]: true }));
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("WebSocket connect error:", error.message);
      setMessages((prev) => [...prev, { from: "System", text: `Connection Error: ${error.message}`, type: "error", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(false);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      setMessages((prev) => [...prev, { from: "System", text: `Disconnected: ${reason}`, type: "error", timestamp: new Date().toLocaleTimeString() }]);
      setIsConnected(false);
    });

    return () => {
      console.log("ChatRoom unmounting, cleaning up WebSocket");
      socketRef.current.off("connect");
      socketRef.current.off("message");
      socketRef.current.off("typing");
      socketRef.current.off("connect_error");
      socketRef.current.off("disconnect");
      socketRef.current.disconnect();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, progressMessage]);

  useEffect(() => {
    if (showCommands && commandsRef.current) {
      commandsRef.current.focus();
    }
  }, [showCommands, filteredCommands]);

  const sendMessage = (messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected) return;

    console.log("Sending message:", messageText);
    const userName = localStorage.getItem('userName') || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
    };

    setMessages((prev) => [
      ...prev,
      { 
        from: userName, 
        text: messageText, 
        type: "user", 
        timestamp: new Date().toLocaleTimeString() 
      }
    ]);

    if (taskPending) {
      messageData.type = "task_response";
      messageData.taskId = taskPending.taskId;
      if (taskPending.question.includes("What’s your name") || taskPending.question.includes("name?")) {
        localStorage.setItem('userName', messageText.trim());
        messageData.user = messageText.trim();
      }
      setTaskPending(null);
    } else if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.target = "bot_lead";
      setMessages((prev) => [...prev, { ...messageData, type: "command", timestamp: new Date().toLocaleTimeString() }]);
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
        console.error("Speech recognition error:", event.error);
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
      console.error("Voice-to-text error:", event.error);
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
    console.log("Manual reconnect triggered with reset");
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
      setMessages((prev) => [...prev, { from: "System", text: "Reset and reconnected", type: "system", timestamp: new Date().toLocaleTimeString() }]);
    }
  };

  const handlePreview = (fileContent) => {
    try {
      const decoded = atob(fileContent);
      const lines = decoded.split('\n').slice(0, 5).join('\n');
      setMessages((prev) => [...prev, { from: "System", text: `Preview:\n\`\`\`\n${lines}\n\`\`\``, type: "system", timestamp: new Date().toLocaleTimeString() }]);
    } catch (e) {
      setMessages((prev) => [...prev, { from: "System", text: "Preview failed—binary file!", type: "error", timestamp: new Date().toLocaleTimeString() }]);
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