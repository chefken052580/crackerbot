import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatMessage from "./ChatMessage";

// Use the ngrok-exposed WebSocket URL directly
const getWebSocketUrl = () => {
  // Hardcode the ngrok WebSocket URL for external access
  const directUrl = "wss://visually-sterling-spider.ngrok-free.app/socket.io/";
  console.log("WebSocket URL:", directUrl);
  return directUrl; // Use the ngrok tunnel URL matching the websocket tunnel
};

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
};

// Rest of the ChatRoom component remains unchanged
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
  const audioRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    console.log("ChatRoom.jsx: Component mounted"); // Sanity check
    const WEBSOCKET_SERVER_URL = getWebSocketUrl();
    console.log("ChatRoom.jsx: Initializing WebSocket with URL:", WEBSOCKET_SERVER_URL);

    try {
      socketRef.current = io(WEBSOCKET_SERVER_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ["websocket"],
        path: "/socket.io",
      });
      console.log("ChatRoom.jsx: Socket.IO initialized");
    } catch (e) {
      console.error("ChatRoom.jsx: Failed to initialize Socket.IO:", e);
      return;
    }

    socketRef.current.on("connect", () => {
      console.log(`ChatRoom.jsx: ✅ WebSocket connected, ID: ${socketRef.current.id}`);
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: "Connected to your private Cracker Bot session", 
          type: "system", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id,
        }
      ]);
      setIsConnected(true);
      const userName = localStorage.getItem('userName') || "Guest";
      socketRef.current.emit("register", { 
        name: "bot_frontend", 
        role: "frontend", 
        userId: socketRef.current.id, 
        userName,
        frontendId: socketRef.current.id,
      });
      socketRef.current.emit("frontend_connected", { 
        ip: window.location.hostname, 
        frontendId: socketRef.current.id,
        userName 
      });
      console.log(`ChatRoom.jsx: 📤 Emitted frontend_connected with ID: ${socketRef.current.id}, userName: ${userName}`);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error(`ChatRoom.jsx: ❌ WebSocket connect error: ${error.message}`, error);
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: `Connection Error: ${error.message}`, 
          type: "error", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id || "unknown",
        }
      ]);
      setIsConnected(false);
    });

    socketRef.current.on("error", (data) => {
      console.error(`ChatRoom.jsx: ❌ WebSocket server error: ${data.message}`, data);
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: `Server Error: ${data.message}`, 
          type: "error", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id || "unknown",
        }
      ]);
    });

    socketRef.current.on("message", (data) => {
      if (data.frontendId === socketRef.current.id) {
        console.log(`ChatRoom.jsx: 📩 Message received for user ${socketRef.current.id}:`, data);
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
          frontendId: data.frontendId,
          progress: data.progress,
        };

        if (data.type === "progress") {
          setProgressMessage((prev) => ({
            ...newMessage,
            progress: data.progress || (prev ? prev.progress : 0),
            taskId: data.taskId || prev?.taskId,
          }));
          if (data.progress === 100) {
            setTimeout(() => setProgressMessage(null), 1000);
          }
          console.log(`ChatRoom.jsx: 📈 Progress update for ${socketRef.current.id}: ${data.text} (${data.progress}%)`);
        } else if (data.type === "download" && data.content) {
          setMessages((prev) => [...prev, newMessage]);
          const byteCharacters = atob(data.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const mimeType = {
            'html': 'text/html', 'js': 'application/javascript', 'py': 'text/x-python', 'php': 'application/x-httpd-php',
            'rb': 'text/x-ruby', 'java': 'text/x-java-source', 'cpp': 'text/x-c++', 'zip': 'application/zip',
            'png': 'image/png', 'jpg': 'image/jpeg', 'gif': 'image/gif', 'txt': 'text/plain',
            'pdf': 'application/pdf', 'csv': 'text/csv', 'json': 'application/json', 'mp4': 'video/mp4'
          }[data.fileName.split('.').pop()] || 'application/octet-stream';
          const blob = new Blob([byteArray], { type: mimeType });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = data.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log(`ChatRoom.jsx: 📥 Download for ${socketRef.current.id}: ${data.fileName}`);
        } else {
          setMessages((prev) => [...prev, newMessage]);
          if ((data.type === "question" || data.type === "success") && data.options && data.options.length > 0) {
            setTaskPending({ taskId: data.taskId || `welcome:${socketRef.current.id}`, question: data.text });
            setCurrentTask((prev) => ({
              ...prev,
              [data.taskId || `welcome:${socketRef.current.id}`]: { 
                step: data.taskId?.includes("initial_name") ? "name" : data.taskId ? "choice" : "welcome" 
              }
            }));
            console.log(`ChatRoom.jsx: ❓ Question for ${socketRef.current.id}: ${data.text}`);
          } else if (data.type === "task_response" && data.taskId) {
            setCurrentTask((prev) => {
              const current = prev[data.taskId] || {};
              if (data.taskId.startsWith("initial_name:")) {
                localStorage.setItem('userName', data.text.trim());
                return { ...prev, [data.taskId]: { ...current, name: data.text, step: "complete" } };
              } else if (current.step === "welcome" && data.text === "Build something epic!") {
                return { ...prev, [data.taskId]: { ...current, step: "name" } };
              } else if (current.step === "name") {
                return { ...prev, [data.taskId]: { ...current, name: data.text, step: "type" } };
              } else if (current.step === "type") {
                return { ...prev, [data.taskId]: { ...current, type: data.text, step: "features" } };
              } else if (current.step === "features") {
                return { ...prev, [data.taskId]: { ...current, features: data.text, step: "building" } };
              } else if (current.step === "choice") {
                return { ...prev, [data.taskId]: { ...current, choice: data.text, step: "complete" } };
              }
              return prev;
            });
            setTaskPending(null);
            console.log(`ChatRoom.jsx: ✅ Task response processed for ${socketRef.current.id}: ${data.text}`);
          } else {
            console.log(`ChatRoom.jsx: 💬 AI message for ${socketRef.current.id}: ${data.text}`);
          }
        }

        if (data.user && data.user !== "Cracker Bot" && data.user !== "System") {
          localStorage.setItem('userName', data.user);
          console.log(`ChatRoom.jsx: 🖋️ Updated userName in localStorage: ${data.user}`);
        }
        if (playSound) audioRef.current?.play().catch(() => console.log("ChatRoom.jsx: Audio play failed"));
      } else {
        console.log(`ChatRoom.jsx: 🚫 Message ignored (not for user ${socketRef.current.id}):`, data);
      }
    });

    socketRef.current.on("typing", (data) => {
      if (data.frontendId === socketRef.current.id) {
        console.log(`ChatRoom.jsx: ⌨️ Typing event received for user ${socketRef.current.id}:`, data);
        setIsTyping((prev) => ({ ...prev, [data.target === "bot_frontend" ? "Cracker Bot" : data.user || "Unknown"]: true }));
      } else {
        console.log(`ChatRoom.jsx: 🚫 Typing ignored (not for user ${socketRef.current.id}):`, data);
      }
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log(`ChatRoom.jsx: 🔌 WebSocket disconnected: ${reason}`);
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: `Disconnected: ${reason}`, 
          type: "error", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id || "unknown",
        }
      ]);
      setIsConnected(false);
    });

    return () => {
      console.log(`ChatRoom.jsx: 🧹 Unmounting, cleaning up WebSocket for ID: ${socketRef.current.id || "unknown"}`);
      socketRef.current.off("connect");
      socketRef.current.off("message");
      socketRef.current.off("typing");
      socketRef.current.off("connect_error");
      socketRef.current.off("error");
      socketRef.current.off("disconnect");
      socketRef.current.disconnect();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, progressMessage, currentTask]);

  useEffect(() => {
    if (showCommands && commandsRef.current) {
      commandsRef.current.focus();
    }
  }, [showCommands, filteredCommands]);

  const sendMessage = (messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected) {
      console.warn(`ChatRoom.jsx: ⚠️ Cannot send: Connected=${isConnected}, Text="${messageText}"`);
      return;
    }

    console.log(`ChatRoom.jsx: 📤 Sending message from user ${socketRef.current.id}:`, messageText);
    const userName = localStorage.getItem('userName') || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
    };

    setMessages((prev) => [
      ...prev,
      { 
        from: userName, 
        text: messageText, 
        type: "user", 
        timestamp: new Date().toLocaleTimeString(),
        frontendId: socketRef.current.id,
      }
    ]);

    if (taskPending) {
      messageData.type = "task_response";
      messageData.taskId = taskPending.taskId;
      if (taskPending.question.includes("What’s your name")) {
        localStorage.setItem('userName', messageText.trim());
        messageData.user = messageText.trim();
        console.log(`ChatRoom.jsx: 🖋️ Set userName in localStorage from task: ${messageText.trim()}`);
      }
      socketRef.current.emit('message', messageData);
      setTaskPending(null);
    } else if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.target = "bot_lead";
      setMessages((prev) => [...prev, { ...messageData, type: "command", timestamp: new Date().toLocaleTimeString() }]);
      socketRef.current.emit('message', messageData);
    } else {
      messageData.type = "general_message";
      socketRef.current.emit('message', messageData);
    }

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
        sendMessage(transcript);
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognition.onerror = (event) => {
        console.error("ChatRoom.jsx: Speech recognition error:", event.error);
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognition.start();
      setIsRecording(true);
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
      recognitionRef.current = null;
    }
  };

  const startVoiceToText = () => {
    if (isRecording) return;
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
      console.error("ChatRoom.jsx: Voice-to-text error:", event.error);
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
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
      recognitionRef.current = null;
    }
  };

  const manualReconnect = () => {
    console.log(`ChatRoom.jsx: 🔄 Manual reconnect triggered for user ${socketRef.current.id || "unknown"}`);
    if (socketRef.current) {
      const userId = socketRef.current.id;
      const ip = window.location.hostname;
      socketRef.current.emit('reset_user', { userId, ip, frontendId: socketRef.current.id });
      localStorage.removeItem('userName');
      setMessages([]);
      setTaskPending(null);
      setCurrentTask({});
      setProgressMessage(null);
      socketRef.current.disconnect();
      socketRef.current.connect();
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: "Reset and reconnected to your private session", 
          type: "system", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id,
        }
      ]);
    }
  };

  const handlePreview = (fileContent) => {
    try {
      const decoded = atob(fileContent);
      const lines = decoded.split('\n').slice(0, 5).join('\n');
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: `Preview:\n\`\`\`\n${lines}\n\`\`\``, 
          type: "system", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id,
        }
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { 
          from: "System", 
          text: "Preview failed—binary file!", 
          type: "error", 
          timestamp: new Date().toLocaleTimeString(),
          frontendId: socketRef.current.id,
        }
      ]);
    }
  };

  const handleColorChange = (scheme) => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
  };

  const toggleSound = () => setPlaySound((prev) => !prev);

  const currentScheme = colorSchemes[colorScheme];

  console.log("ChatRoom.jsx: Rendering component, isConnected:", isConnected); // Sanity check

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
            {!isConnected && (
              <div className={`text-center ${currentScheme.text}`}>
                Connecting to your private Cracker Bot session...
              </div>
            )}
            {isConnected && messages.length === 0 && !progressMessage && (
              <div className={`text-center ${currentScheme.text}`}>
                Welcome to Cracker Bot! Your private AI chat—type a message or /guide to start.
              </div>
            )}
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
              Task Name: {currentTask[taskPending.taskId].name || "Pending"} | 
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
              disabled={!isConnected}
            />
            <button
              onMouseDown={startVoiceToText}
              onMouseUp={stopVoiceToText}
              onTouchStart={startVoiceToText}
              onTouchEnd={stopVoiceToText}
              className={`p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? 'scale-110 animate-pulse' : ''}`}
              disabled={!isConnected}
            >
              🎙️
            </button>
            <button
              onClick={() => sendMessage(input)}
              className={`${currentScheme.button} ${currentScheme.buttonText} px-4 py-2 rounded-r-md transition`}
              disabled={!isConnected}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />
    </div>
  );
};

export default ChatRoom;