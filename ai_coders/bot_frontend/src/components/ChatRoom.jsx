import React, { useState, useEffect, useRef } from "react";
import WebSocketManager from "../utils/WebSocketManager";
import ChatMessage from "./ChatMessage";
import PreviewPopup from "./PreviewPopup"; // New import
import { commands, colorSchemes } from "../config/chatConfig";

const WEBSOCKET_SERVER_URL =
  process.env.REACT_APP_WEBSOCKET_SERVER_URL || "wss://websocket-visually-sterling-spider.ngrok-free.app";

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
  const [editMode, setEditMode] = useState(null);
  const [colorScheme, setColorScheme] = useState(localStorage.getItem("colorScheme") || "neon");
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [postTaskOptions, setPostTaskOptions] = useState(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [taskProgress, setTaskProgress] = useState({});
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);

  const initializeSocket = () => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = new WebSocketManager(WEBSOCKET_SERVER_URL, {
      onConnect: (id) => {
        console.log("ChatRoom: WebSocket connected, ID:", id);
        setMessages((prev) => [
          ...prev.filter((msg) => msg.type !== "system" || !msg.text.includes("Reset and reconnected")),
          { from: "System", text: "Cracker Bot’s fired up and ready to rock! 🚀", type: "system", timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(true);
        setRetryAttempts(0);
        const userName = localStorage.getItem("userName") || "Guest";
        socketRef.current.emit("register", { name: userName, role: "frontend", frontendId: id, userName });
        socketRef.current.emit("frontend_connected", { ip: window.location.hostname, frontendId: id, userName });
      },
      onMessage: (data) => {
        console.log("ChatRoom: Message received:", data);
        const userName = localStorage.getItem("userName") || "Guest";
        const newMessage = {
          from: data.from || "Cracker Bot",
          user: data.user || userName,
          text: data.text || "",
          type: data.type || "bot",
          fileName: data.fileName,
          content: data.content,
          downloadLink: data.downloadLink,
          taskId: data.taskId,
          options: data.options,
          timestamp: new Date().toLocaleTimeString(),
          frontendId: data.frontendId,
          taskName: data.taskName,
          taskType: data.taskType,
          taskFeatures: data.taskFeatures,
          projects: data.projects,
          progress: data.type === "progressUpdate" ? data.progress : undefined,
        };

        if (data.type === "progressUpdate" && data.taskId) {
          setTaskProgress((prev) => ({
            ...prev,
            [data.taskId]: data.progress,
          }));
          setMessages((prev) => {
            const existingIdx = prev.findIndex((msg) => msg.taskId === data.taskId && msg.type === "progressUpdate");
            if (existingIdx >= 0) {
              const updatedMessages = [...prev];
              updatedMessages[existingIdx] = { ...updatedMessages[existingIdx], progress: data.progress, text: data.text };
              return updatedMessages;
            } else {
              return [...prev, newMessage];
            }
          });
        } else {
          setMessages((prev) => [...prev, newMessage]);
          if (data.type === "download") {
            setTaskPending(null);
            setCurrentTask((prev) =>
              prev ? { ...prev, taskStatus: "completed", name: data.taskName, type: data.taskType, features: data.taskFeatures } : null
            );
            setEditMode(data.taskId);
            setPostTaskOptions({
              taskId: data.taskId,
              frontendId: data.frontendId,
              taskName: data.taskName,
              taskType: data.taskType,
              taskFeatures: data.taskFeatures,
              fileContent: data.content,
            });
          } else if (data.type === "success" && data.projects) {
            setTaskPending(null);
            setCurrentTask(null);
            setEditMode(null);
            setPostTaskOptions(null);
          } else if (data.type === "question" && data.taskId) {
            setTaskPending({ taskId: data.taskId, question: data.text, options: data.options });
            setCurrentTask((prev) => ({
              taskId: data.taskId,
              name: data.taskName || prev?.name || "Pending",
              type: data.taskType || prev?.type || "Pending",
              features: data.taskFeatures || prev?.features || "Pending",
              step: data.text.toLowerCase().includes("name") && !localStorage.getItem("userName")
                ? "name"
                : data.text.toLowerCase().includes("type")
                ? "type"
                : data.text.toLowerCase().includes("features")
                ? "features"
                : data.text.toLowerCase().includes("chat") || data.text.toLowerCase().includes("build")
                ? "choice"
                : "review",
              taskStatus: "pending",
            }));
            setEditMode(data.taskId && data.text.toLowerCase().includes("restart") ? data.taskId : null);
            setPostTaskOptions(null);
          } else if (data.type === "success" && data.options) {
            setTaskPending(null);
            setCurrentTask((prev) => (prev ? { ...prev, step: "choice" } : null));
          } else if (data.type === "error" && data.taskId) {
            setTaskPending(null);
            setCurrentTask(null);
            setEditMode(null);
            setPostTaskOptions(null);
          }
        }

        setIsTyping((prev) => ({ ...prev, [data.from || "Cracker Bot"]: false }));
        if (data.user && data.user !== userName && data.user !== "Guest") {
          localStorage.setItem("userName", data.user);
        }
      },
      onConnectError: (error) => {
        console.error("ChatRoom: WebSocket connect error:", error.message);
        setMessages((prev) => [
          ...prev,
          { from: "System", text: `Connection glitch: ${error.message} (Retry ${retryAttempts + 1}/10) ⚡️`, type: "error", timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(false);
        setRetryAttempts((prev) => prev + 1);
      },
      onDisconnect: (reason) => {
        console.log("ChatRoom: WebSocket disconnected:", reason);
        setMessages((prev) => [
          ...prev,
          { from: "System", text: `Offline: ${reason}—rebooting soon! 💥`, type: "error", timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(false);
      },
    });
  };

  useEffect(() => {
    console.log("ChatRoom: Mounting component...");
    initializeSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  useEffect(() => {
    document.body.className = `${colorSchemes[colorScheme].bg} relative`;
    if (colorScheme === "matrix") {
      document.body.style.backgroundImage = "none";
      initMatrixRain();
    } else {
      document.body.style.backgroundImage = "none";
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [colorScheme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const initMatrixRain = () => {
    if (colorScheme !== "matrix" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(10, 15, 10, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff85";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        const yPos = drops[i] * fontSize;
        ctx.fillStyle = `rgba(0, 255, 133, ${Math.max(1 - yPos / canvas.height, 0.2)})`;
        ctx.fillText(text, i * fontSize, yPos);
        if (yPos > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const animate = () => {
      draw();
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drops.length = Math.floor(canvas.width / fontSize);
      drops.fill(1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  };

  const sendMessage = (messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected || isSending) return;

    setIsSending(true);
    const userName = localStorage.getItem("userName") || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.socket.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.socket.id,
    };

    const userMessage = {
      from: userName,
      user: userName,
      text: messageText.trim(),
      type: messageText.startsWith("/") ? "command" : "user",
      timestamp: new Date().toLocaleTimeString(),
      className: "user-message" + (messageText.startsWith("/") ? " command" : ""),
      taskId: currentTask?.taskId,
    };
    setMessages((prev) => [...prev, userMessage]);

    if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.commandFlag = true;
      messageData.target = "bot_lead";
      const commandParts = messageText.split(" ");
      const command = commandParts[0].toLowerCase();

      if (command === "/commands") {
        const commandList = commands.map((cmd) => `${cmd.command}: ${cmd.description}`).join("\n");
        setMessages((prev) => [
          ...prev,
          {
            from: "System",
            user: userName,
            text: `Available commands:\n${commandList}`,
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setIsSending(false);
        setInput("");
        setShowCommands(false);
        setCommandIndex(-1);
        inputRef.current?.focus();
        return;
      }

      switch (command) {
        case "/reset_name":
          localStorage.removeItem("userName");
          setMessages((prev) => [
            ...prev,
            {
              from: "System",
              user: userName,
              text: "Name reset! Unleash a new identity. 🌟",
              type: "system",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          setCurrentTask({ taskId: `initial_name:${socketRef.current.socket.id}`, step: "name", taskStatus: "pending" });
          break;
        case "/delete":
          if (commandParts.length < 2) {
            setMessages((prev) => [
              ...prev,
              {
                from: "Cracker Bot",
                user: userName,
                text: `Yo ${userName}, gotta tell me which project to nuke! Use /delete <taskId>—check /projects for IDs. 💥`,
                type: "error",
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }
          break;
        default:
          socketRef.current.emit("message", messageData);
          break;
      }
    } else {
      const lastWelcome = messages.find((m) => m.type === "success" && m.options && m.taskId);
      if (currentTask && currentTask.taskStatus !== "completed") {
        messageData.type = "task_response";
        messageData.taskId = currentTask.taskId;
        if (currentTask.step === "name" && !localStorage.getItem("userName")) {
          localStorage.setItem("userName", messageText.trim());
          messageData.user = messageText.trim();
          setCurrentTask((prev) => ({ ...prev, step: "choice" }));
        } else if (currentTask.step === "features") {
          setMessages((prev) => [
            ...prev,
            {
              from: "Cracker Bot",
              text: "Cracker Bot is cooking your epic build! 🍳",
              type: "progressUpdate",
              taskId: currentTask.taskId,
              progress: 0,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      } else if (lastWelcome && (messageText === "Chat" || messageText === "Build-Something-Epic")) {
        messageData.type = "task_response";
        messageData.taskId = lastWelcome.taskId;
      } else {
        messageData.type = "general_message";
      }
      socketRef.current.emit("message", messageData);
    }

    setInput("");
    setShowCommands(false);
    setCommandIndex(-1);
    setTimeout(() => {
      setIsSending(false);
      inputRef.current?.focus();
    }, 100);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith("/")) {
      const query = value.slice(1).toLowerCase();
      const filtered = commands.filter((cmd) => cmd.command.toLowerCase().startsWith(query));
      setFilteredCommands(filtered);
      setShowCommands(true);
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
        const selectedCommand = filteredCommands[commandIndex].command;
        setInput(selectedCommand + " ");
        setShowCommands(false);
        setCommandIndex(-1);
        inputRef.current?.focus();
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
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (commandIndex >= 0) {
          const selectedCommand = filteredCommands[commandIndex].command;
          setInput(selectedCommand + " ");
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
        }
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
        setMessages((prev) => [
          ...prev,
          { from: "System", text: "Mic’s a no-go—type it out, maestro! 🎹", type: "error", timestamp: new Date().toLocaleTimeString() },
        ]);
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
        setMessages((prev) => [
          ...prev,
          {
            from: "System",
            text: `Mic meltdown: ${event.error === "no-speech" ? "Silence detected!" : event.error}. Back to the keyboard!`,
            type: "error",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  };

  const manualReconnect = () => {
    if (!socketRef.current) return;
    const oldUserId = socketRef.current.socket.id;
    const ip = window.location.hostname;
    localStorage.removeItem("userName");
    socketRef.current.emit("reset_user", { userId: oldUserId, ip });
    socketRef.current.disconnect();
    setMessages([]);
    setTaskPending(null);
    setCurrentTask(null);
    setEditMode(null);
    setRetryAttempts(0);
    initializeSocket();
  };

  const handleColorChange = (scheme) => {
    setColorScheme(scheme);
    localStorage.setItem("colorScheme", scheme);
  };

  const handlePostTaskAction = (action) => {
    if (!postTaskOptions) return;
    const { taskId, frontendId, taskName, taskType, taskFeatures, fileContent } = postTaskOptions;
    const userName = localStorage.getItem("userName") || "Guest";

    const messageData = {
      text: action,
      type: "task_response",
      taskId,
      frontendId,
      user: userName,
      userId: socketRef.current.socket.id,
      ip: window.location.hostname,
      taskName,
      taskType,
      taskFeatures,
      fileContent,
      commandFlag: action !== "Done",
      target: "bot_lead",
    };

    setMessages((prev) => [
      ...prev,
      {
        from: userName,
        user: userName,
        text: action,
        type: "user",
        timestamp: new Date().toLocaleTimeString(),
        className: "user-message",
      },
    ]);

    if (action === "Restart") {
      setCurrentTask({ taskId: `${Date.now()}`, step: "choice", taskStatus: "pending" });
      setTaskPending({ taskId: messageData.taskId, question: "Chat or Build-Something-Epic—what’s your vibe?", options: ["Chat", "Build-Something-Epic"] });
      setPostTaskOptions(null);
      setEditMode(null);
      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          user: userName,
          text: `Resetting "${taskName}"—new cosmic journey begins! 🌈`,
          type: "system",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } else if (action === "Refine Project") {
      setCurrentTask((prev) => ({
        ...prev,
        step: "pending_features",
        taskStatus: "pending",
        previousContent: fileContent,
      }));
      setTaskPending({ taskId: messageData.taskId, question: `Supercharge "${taskName}"—what’s the next big idea?`, options: [] });
      setPostTaskOptions(null);
      setEditMode(null);
      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          user: userName,
          text: `Refining "${taskName}"—let’s crank it to 11! 🎸`,
          type: "system",
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          from: "Cracker Bot",
          text: "Cracker Bot is refining your epic build! 🍳",
          type: "progressUpdate",
          taskId: taskId,
          progress: 0,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } else if (action === "Done") {
      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          user: userName,
          text: `"${taskName}" is sealed in the vault! Fetch it with /projects. 🏆`,
          type: "system",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setPostTaskOptions(null);
      setCurrentTask(null);
      setTaskPending(null);
      setEditMode(null);
    }

    socketRef.current.emit("message", messageData);
    setInput("");
    setShowCommands(false);
    setCommandIndex(-1);
    setTimeout(() => {
      setIsSending(false);
      inputRef.current?.focus();
    }, 100);
  };

  const handleOptionClick = (option, projectData) => {
    const userName = localStorage.getItem("userName") || "Guest";
    if (projectData) {
      const { taskId, content, fileName } = projectData.projectData || {};
      if (!taskId) return;

      if (option === "Refine Project") {
        setCurrentTask({ taskId, step: "pending_features", taskStatus: "pending" });
        setTaskPending({ taskId, question: `Add epic features to "${projectData.text}"!`, options: [] });
        socketRef.current.emit("message", {
          text: "Refine Project",
          type: "task_response",
          taskId,
          frontendId: socketRef.current.socket.id,
          user: userName,
          userId: socketRef.current.socket.id,
          ip: window.location.hostname,
          commandFlag: true,
          target: "bot_lead",
        });
      } else if (option === "Download") {
        if (content && fileName) {
          const link = document.createElement("a");
          link.href = `data:application/zip;base64,${content}`;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setMessages((prev) => [
            ...prev,
            {
              from: "System",
              user: userName,
              text: `Downloading "${projectData.text}"—grab it now! 📥`,
              type: "system",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      } else if (option === "Delete") {
        socketRef.current.emit("message", {
          text: `/delete ${taskId}`,
          type: "command",
          taskId,
          frontendId: socketRef.current.socket.id,
          user: userName,
          userId: socketRef.current.socket.id,
          ip: window.location.hostname,
          commandFlag: true,
          target: "bot_lead",
        });
      }
    } else {
      sendMessage(option);
    }
  };

  const currentScheme = colorSchemes[colorScheme];

  return (
    <div className={`flex flex-col h-full ${currentScheme.bg} ${currentScheme.text} overflow-hidden relative`}>
      {colorScheme === "matrix" && (
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" />
      )}
      <div className="flex-shrink-0 p-4 flex justify-between items-center relative z-10">
        <h2 className={`text-2xl font-bold ${currentScheme.accent}`}>
          Cracker Bot Chat Room {editMode ? "(Edit Mode)" : ""}
        </h2>
        <div className="flex space-x-2">
          <select
            value={colorScheme}
            onChange={(e) => handleColorChange(e.target.value)}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:shadow-glow transition-shadow`}
          >
            <option value="neon">Neon</option>
            <option value="cyberpunk">Cyberpunk</option>
            <option value="retro">Retro</option>
            <option value="pastel">Pastel</option>
            <option value="matrix">Matrix</option>
          </select>
          <button
            onClick={toggleRecording}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
          >
            {isRecording ? "🎙️" : "🎤"}
          </button>
          <button
            onClick={manualReconnect}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
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
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
          >
            Download Transcript
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className={`w-full max-w-3xl flex flex-col h-[80vh] max-h-[80vh] mx-4 ${editMode ? "border-2 border-matrix-green shadow-glow" : ""}`}>
          <div
            ref={chatContainerRef}
            className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto`}
          >
            {messages.map((msg, index) => (
              <div key={index} className="message-wrapper mb-2">
                <ChatMessage
                  message={msg}
                  taskResult={msg.content ? { content: msg.content, downloadLink: msg.downloadLink } : null}
                  onPreview={
                    msg.content
                      ? () => PreviewPopup({ fileContent: msg.content, fileName: msg.fileName, socket: socketRef.current, postTaskOptions, setMessages })
                      : null
                  }
                  onOptionClick={(option) => handleOptionClick(option, msg.projects ? msg : null)}
                  colorScheme={currentScheme}
                  progress={taskProgress[msg.taskId]}
                />
              </div>
            ))}
            {Object.entries(isTyping).map(([user, typing]) => typing && (
              <div key={user} className="text-gray-500 italic animate-pulse mb-2">{`${user} is conjuring a message...`}</div>
            ))}
          </div>

          {currentTask && (
            <div className="text-gray-400 my-2 italic">
              Task: {currentTask.name || "Unnamed Epic"} | Type: {currentTask.type || "TBD"} | Features: {currentTask.features || "Cooking..."}
            </div>
          )}

          {showCommands && (
            <div
              ref={commandsRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={`absolute bottom-12 left-0 w-full max-w-3xl ${currentScheme.chatBg} border border-gray-600 rounded-md shadow-md p-2 z-20 max-h-64 overflow-y-auto`}
            >
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <div
                    key={cmd.command}
                    onClick={() => handleCommandSelect(cmd.command)}
                    className={`cursor-pointer p-2 rounded-md ${idx === commandIndex ? "bg-gray-600" : "hover:bg-gray-700"} transition-colors`}
                  >
                    <span className={`${currentScheme.accent} font-bold`}>{cmd.command}</span> - {cmd.description}
                  </div>
                ))
              ) : (
                <div className="p-2 text-gray-500">No matching commands</div>
              )}
            </div>
          )}

          {postTaskOptions && (
            <div className="flex justify-center space-x-4 mt-4">
              <button
                onClick={() => handlePostTaskAction("Restart")}
                className={`px-3 py-1 rounded-full ${currentScheme.bubble} text-sm font-semibold hover:scale-105 transition-transform shadow-glow`}
              >
                Restart
              </button>
              <button
                onClick={() => handlePostTaskAction("Refine Project")}
                className={`px-3 py-1 rounded-full ${currentScheme.bubble} text-sm font-semibold hover:scale-105 transition-transform shadow-glow`}
              >
                Refine Project
              </button>
              <button
                onClick={() => handlePostTaskAction("Done")}
                className={`px-3 py-1 rounded-full ${currentScheme.bubble} text-sm font-semibold hover:scale-105 transition-transform shadow-glow`}
              >
                Done
              </button>
            </div>
          )}

          <div className="flex mt-2 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                taskPending
                  ? `Answer: ${taskPending.question}`
                  : editMode
                  ? "Tweak your masterpiece..."
                  : "Type your message or /command..."
              }
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-gray-600 ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-${currentScheme.accent.split("-")[1]} transition-shadow`}
            />
            <button
              onClick={toggleRecording}
              className={`p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? "scale-110 animate-pulse" : ""}`}
            >
              🎙️
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!isConnected || !input.trim() || isSending}
              className={`px-4 py-2 rounded-r-md transition ${
                isConnected && input.trim() && !isSending
                  ? `${currentScheme.button} ${currentScheme.buttonText} hover:shadow-glow`
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
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