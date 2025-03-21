// bot_frontend/src/components/ChatRoom.jsx
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
];

const colorSchemes = {
  neon: {
    bg: "bg-gray-900",
    chatBg: "bg-gray-800",
    text: "text-gray-300",
    user: "text-neon-yellow bg-gray-700 shadow-lg border-2 border-neon-yellow rounded-lg p-2 transform animate-pulse",
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
  cyberpunk: {
    bg: "bg-cyber-dark",
    chatBg: "bg-gray-900",
    text: "text-cyber-cyan",
    user: "text-cyber-pink bg-gray-900 border-2 border-cyber-pink rounded-lg p-2 shadow-cyber animate-glow",
    bot: "text-cyber-cyan bg-gray-900",
    system: "text-cyber-purple bg-cyber-dark italic",
    command: "text-white bg-gray-900",
    success: "text-cyber-cyan bg-gray-900",
    error: "text-neon-red bg-gray-900",
    question: "text-cyber-cyan bg-gray-900",
    progress: "bg-gray-900",
    download: "bg-cyber-purple text-cyber-cyan",
    button: "bg-cyber-cyan hover:bg-neon-blue",
    buttonText: "text-cyber-dark",
    accent: "text-cyber-pink",
    bubble: "bg-cyber-cyan hover:bg-cyber-pink text-cyber-dark font-semibold",
  },
  retro: {
    bg: "bg-stone-200",
    chatBg: "bg-retro-dark",
    text: "text-retro-orange",
    user: "text-retro-orange bg-retro-dark border-2 border-retro-orange rounded-sm p-2 shadow-retro",
    bot: "text-retro-green bg-retro-dark",
    system: "text-retro-blue bg-stone-200 italic",
    command: "text-retro-blue bg-retro-dark",
    success: "text-retro-green bg-retro-dark",
    error: "text-neon-red bg-retro-dark",
    question: "text-retro-orange bg-retro-dark",
    progress: "bg-retro-dark",
    download: "bg-retro-green text-stone-200",
    button: "bg-retro-orange hover:bg-retro-orange",
    buttonText: "text-stone-900",
    accent: "text-retro-orange",
    bubble: "bg-retro-green hover:bg-retro-orange text-stone-900 font-semibold",
  },
  pastel: {
    bg: "bg-pastel-bg",
    chatBg: "bg-pastel-light",
    text: "text-pastel-dark",
    user: "text-pastel-pink bg-pastel-light border-2 border-pastel-pink rounded-lg p-2 shadow-pastel",
    bot: "text-pastel-blue bg-pastel-light",
    system: "text-pastel-purple bg-pastel-bg italic",
    command: "text-pastel-teal bg-pastel-light",
    success: "text-pastel-blue bg-pastel-light",
    error: "text-neon-red bg-pastel-light",
    question: "text-pastel-dark bg-pastel-light",
    progress: "bg-pastel-light",
    download: "bg-pastel-blue text-pastel-bg",
    button: "bg-pastel-pink hover:bg-pastel-teal",
    buttonText: "text-pastel-dark",
    accent: "text-pastel-pink",
    bubble: "bg-pastel-blue hover:bg-pastel-teal text-pastel-dark font-semibold",
  },
  matrix: {
    bg: "bg-matrix-dark",
    chatBg: "bg-matrix-bg",
    text: "text-matrix-green",
    user: "text-matrix-green bg-matrix-bg border-2 border-matrix-green rounded-sm p-2 animate-matrix-glitch font-mono",
    bot: "text-matrix-green bg-matrix-bg",
    system: "text-neon-blue bg-matrix-bg italic",
    command: "text-neon-purple bg-matrix-bg",
    success: "text-matrix-green bg-matrix-bg",
    error: "text-neon-red bg-matrix-bg",
    question: "text-matrix-green bg-matrix-bg",
    progress: "bg-matrix-bg",
    download: "bg-matrix-green text-matrix-dark",
    button: "bg-matrix-green hover:bg-neon-blue",
    buttonText: "text-matrix-dark",
    accent: "text-matrix-green",
    bubble: "bg-matrix-green hover:bg-neon-blue text-matrix-dark font-semibold",
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
  const [postTaskOptions, setPostTaskOptions] = useState(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    document.body.className = `${colorSchemes[colorScheme].bg} relative`;
    if (colorScheme === "matrix") {
      document.body.style.backgroundImage = "none";
      initMatrixRain();
    } else {
      document.body.style.backgroundImage = "none";
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [colorScheme]);

  const initMatrixRain = () => {
    if (colorScheme !== "matrix" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(10, 15, 10, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff00";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        const yPos = drops[i] * fontSize;
        ctx.fillStyle = `rgba(0, 255, 0, ${Math.max(1 - yPos / canvas.height, 0.2)})`;
        ctx.fillText(text, i * fontSize, yPos);
        if (yPos > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  };

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

    socketRef.current.on("connect", () => {
      console.log("ChatRoom: WebSocket connected, ID:", socketRef.current.id);
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: "Connected to Cracker Bot!", 
        type: "system", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
      setIsConnected(true);
      setRetryAttempts(0);
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
    });

    socketRef.current.on("message", (data) => {
      console.log("ChatRoom: Message received:", data);
      setIsTyping((prev) => ({ ...prev, [data.from || "Cracker Bot"]: false }));
      const userName = localStorage.getItem('userName') || "Guest";
      const newMessage = {
        from: data.from || "Cracker Bot",
        user: data.user || userName,
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
      };

      if (data.type === "progress") {
        setProgressMessage((prev) => ({
          ...newMessage,
          id: data.taskId,
        }));
        if (data.progress === 100) {
          setMessages((prev) => [...prev.filter(m => m.type !== "progress" || m.taskId !== data.taskId), newMessage]);
          setCurrentTask((prev) => (prev ? { ...prev, taskStatus: "building_complete" } : null));
          setProgressMessage(null);
        }
      } else if (data.type === "download") {
        setMessages((prev) => [...prev.filter(m => m.type !== "progress" || m.taskId !== data.taskId), newMessage]);
        setProgressMessage(null);
        setTaskPending(null);
        setCurrentTask((prev) => (prev ? { ...prev, taskStatus: "completed", name: data.taskName, type: data.taskType, features: data.taskFeatures } : null));
        setEditMode(data.taskId);
        setPostTaskOptions({ taskId: data.taskId, frontendId: data.frontendId, taskName: data.taskName, taskType: data.taskType, taskFeatures: data.taskFeatures, fileContent: data.content });
      } else if (data.type === "projects") {
        const projects = data.text.split('\n').slice(1, -1).map((line, index) => ({
          id: `${data.taskId || 'proj'}-${index}`,
          text: line,
          type: "project",
          timestamp: new Date().toLocaleTimeString(),
          options: ["Download", "Enhance"],
        }));
        setMessages((prev) => [...prev.filter(m => m.type !== "progress" || m.taskId !== data.taskId), ...projects]);
        setTaskPending(null);
        setCurrentTask(null);
        setProgressMessage(null);
        setEditMode(null);
        setPostTaskOptions(null);
      } else {
        setMessages((prev) => {
          const exists = prev.some(m => m.taskId === newMessage.taskId && m.timestamp === newMessage.timestamp && m.text === newMessage.text);
          return exists ? prev : [...prev.filter(m => m.type !== "progress" || m.taskId !== data.taskId), newMessage];
        });
        if (data.type === "question" && data.taskId) {
          setTaskPending({ taskId: data.taskId, question: data.text, options: data.options });
          setCurrentTask((prev) => ({
            taskId: data.taskId,
            name: data.taskName || prev?.name || "Pending",
            type: data.taskType || prev?.type || "Pending",
            features: data.taskFeatures || prev?.features || "Pending",
            step: data.text.toLowerCase().includes("name") && !localStorage.getItem('userName') ? "name" :
                  data.text.toLowerCase().includes("type") ? "type" :
                  data.text.toLowerCase().includes("features") ? "features" :
                  data.text.toLowerCase().includes("chat") || data.text.toLowerCase().includes("build") ? "choice" : "review",
            taskStatus: "pending",
          }));
          setEditMode(data.taskId && data.text.toLowerCase().includes("edit") ? data.taskId : null);
          setPostTaskOptions(null);
          setProgressMessage(null);
        } else if (data.type === "success" && data.options) {
          setTaskPending(null);
          setCurrentTask((prev) => (prev ? { ...prev, step: "choice" } : null));
          setProgressMessage(null);
        } else if (data.type === "error" && data.taskId) {
          setProgressMessage(null);
          setTaskPending(null);
          setCurrentTask(null);
          setEditMode(null);
          setPostTaskOptions(null);
        }
      }

      if (data.user && data.user !== "Guest") {
        localStorage.setItem("userName", data.user);
      }
    });

    socketRef.current.on("typing", (data) => {
      setIsTyping((prev) => ({ ...prev, [data.target === "bot_frontend" ? "Cracker Bot" : data.user || "Unknown"]: true }));
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("ChatRoom: WebSocket connect error:", error.message);
      setMessages((prev) => [...prev, { 
        from: "System", 
        text: `Connection Error: ${error.message} (Attempt ${retryAttempts + 1}/10)`, 
        type: "error", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
      setIsConnected(false);
      setRetryAttempts((prev) => prev + 1);
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

    return () => {
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("message");
        socketRef.current.off("typing");
        socketRef.current.off("connect_error");
        socketRef.current.off("disconnect");
        socketRef.current.disconnect();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, progressMessage, postTaskOptions]);

  useEffect(() => {
    if (showCommands && commandsRef.current) {
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
    const userName = localStorage.getItem("userName") || "Guest";
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
    };

    setMessages((prev) => [...prev, {
      from: userName,
      user: userName,
      text: messageText.trim(),
      type: "user",
      timestamp: new Date().toLocaleTimeString(),
      className: "user-message",
    }]);

    const lastWelcome = messages.find(m => m.type === "success" && m.options && m.taskId);
    if (messageText.startsWith("/")) {
      messageData.type = "command";
      messageData.target = "bot_lead";
      const commandParts = messageText.split(" ");
      const command = commandParts[0].toLowerCase();

      switch (command) {
        case "/create":
          messageData.text = "Build-Something-Epic";
          break;
        case "/projects":
        case "/download":
          socketRef.current.emit("message", messageData);
          setIsSending(false);
          setInput("");
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
          return;
        case "/reset_name":
          localStorage.removeItem("userName");
          socketRef.current.emit("reset_user", { userId: socketRef.current.id, ip: window.location.hostname });
          setMessages((prev) => [...prev, {
            from: "System",
            user: userName,
            text: "Name reset! Please enter a new name.",
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setCurrentTask({ taskId: `initial_name:${socketRef.current.id}`, step: "name", taskStatus: "pending" });
          setIsSending(false);
          setInput("");
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
          return;
        case "/tone":
          const tone = commandParts[1] || "default";
          messageData.text = `/tone ${tone}`;
          break;
        case "/guide":
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            user: userName,
            text: "Available commands:\n" + commands.map(cmd => `${cmd.command}: ${cmd.description}`).join("\n"),
            type: "system",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          setInput("");
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
          return;
        default:
          setMessages((prev) => [...prev, {
            from: "Cracker Bot",
            user: userName,
            text: `Unknown command: ${command}. Try /guide for help!`,
            type: "error",
            timestamp: new Date().toLocaleTimeString(),
          }]);
          setIsSending(false);
          setInput("");
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
          return;
      }
    } else if (lastWelcome && (messageText === "Chat" || messageText === "Build-Something-Epic")) {
      messageData.type = "task_response";
      messageData.taskId = lastWelcome.taskId;
    } else if (currentTask && currentTask.taskStatus !== "completed") {
      messageData.type = "task_response";
      messageData.taskId = currentTask.taskId;
      if (currentTask.step === "name" && !localStorage.getItem("userName")) {
        localStorage.setItem("userName", messageText.trim());
        messageData.user = messageText.trim();
        setCurrentTask((prev) => ({ ...prev, step: "choice" }));
      } else if (currentTask.step === "choice") {
        if (messageText.toLowerCase() === "build-something-epic") {
          setCurrentTask((prev) => ({ ...prev, step: "project_name" }));
        } else if (messageText.toLowerCase() === "chat") {
          setCurrentTask((prev) => ({ ...prev, step: "chat" }));
        }
      } else if (currentTask.step === "project_name") {
        setCurrentTask((prev) => ({ ...prev, name: messageText, step: "type" }));
      } else if (currentTask.step === "type") {
        setCurrentTask((prev) => ({ ...prev, type: messageText, step: "features" }));
      } else if (currentTask.step === "features") {
        setCurrentTask((prev) => ({ ...prev, features: messageText, step: "building" }));
      }
    } else {
      messageData.type = "general_message";
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

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith("/")) {
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
        setMessages((prev) => [...prev, {
          from: "System",
          text: "Sorry, speech recognition isn’t supported here! Type instead.",
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
        setMessages((prev) => [...prev, {
          from: "System",
          text: `Oops, speech failed: ${event.error === "no-speech" ? "No speech detected!" : event.error}. Try typing!`,
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
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  };

  const manualReconnect = () => {
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
      setRetryAttempts(0);
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
      userId: socketRef.current.id,
      ip: window.location.hostname,
      taskName,
      taskType,
      taskFeatures,
      commandFlag: action !== "Done",
      target: "bot_lead",
    };

    if (action === "Edit") {
      // Restart the task from scratch
      setCurrentTask({
        taskId: `${Date.now()}`,
        step: "project_name",
        taskStatus: "pending",
      });
      setTaskPending({ taskId: messageData.taskId, question: "Name your new project!", options: [] });
      setPostTaskOptions(null);
      setEditMode(null);
      setMessages((prev) => [...prev, {
        from: "System",
        user: userName,
        text: `Restarting "${taskName}" from scratch...`,
        type: "system",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (action === "Add-More") {
      // Enhance the existing build
      setCurrentTask((prev) => ({
        ...prev,
        step: "features",
        taskStatus: "pending",
        previousContent: fileContent, // Pass the existing content
      }));
      setTaskPending({ taskId: messageData.taskId, question: `Add more features to "${taskName}"!`, options: [] });
      setPostTaskOptions(null);
      setEditMode(null);
      setMessages((prev) => [...prev, {
        from: "System",
        user: userName,
        text: `Enhancing "${taskName}"...`,
        type: "system",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (action === "Done") {
      // Finalize and store in Redis
      socketRef.current.emit("message", messageData);
      setMessages((prev) => [...prev, {
        from: "System",
        user: userName,
        text: `"${taskName}" completed and stored! Access it with /projects or /download.`,
        type: "system",
        timestamp: new Date().toLocaleTimeString(),
      }]);
      setPostTaskOptions(null);
      setCurrentTask(null);
      setTaskPending(null);
      setEditMode(null);
      setProgressMessage(null);
      setIsSending(false);
      inputRef.current?.focus();
      return;
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

  const handleProjectAction = (action, projectMessage) => {
    const projectId = projectMessage.text.split('.')[0];
    const messageData = {
      text: action === "Download" ? "/download" : "Enhance Project " + projectId,
      type: action === "Download" ? "command" : "task_response",
      user: localStorage.getItem("userName") || "Guest",
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
      taskId: projectMessage.taskId || `${socketRef.current.id}-${Date.now()}`,
      commandFlag: action === "Enhance",
      target: "bot_lead",
    };
    socketRef.current.emit("message", messageData);
    if (action === "Enhance") {
      setTaskPending({ taskId: messageData.taskId, question: `Add features to enhance project ${projectId}`, options: [] });
      setCurrentTask({ taskId: messageData.taskId, step: "features", taskStatus: "pending" });
    }
  };

  const currentScheme = colorSchemes[colorScheme];

  return (
    <div className={`flex flex-col h-full ${currentScheme.bg} ${currentScheme.text} overflow-hidden relative`}>
      {colorScheme === "matrix" && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
        />
      )}
      <div className="flex-shrink-0 p-4 flex justify-between items-center relative z-10">
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
            <option value="cyberpunk">Cyberpunk</option>
            <option value="retro">Retro</option>
            <option value="pastel">Pastel</option>
            <option value="matrix">Matrix</option>
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

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className={`w-full max-w-3xl flex flex-col h-[80vh] max-h-[80vh] mx-4 ${editMode ? "border-2 border-matrix-green" : ""}`}>
          <div className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto`}>
            {messages.map((msg, index) => (
              <div key={index}>
                <ChatMessage
                  message={msg}
                  onPreview={msg.fileContent ? () => handlePreview(msg.fileContent) : null}
                  onOptionClick={(option) => {
                    if (msg.type === "project") {
                      handleProjectAction(option, msg);
                    } else {
                      sendMessage(option);
                    }
                  }}
                  colorScheme={currentScheme}
                />
              </div>
            ))}
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

          {postTaskOptions && (
            <div className="flex justify-center space-x-4 mt-4">
              <button
                onClick={() => handlePostTaskAction("Edit")}
                className={`px-4 py-2 rounded-full ${currentScheme.bubble}`}
              >
                Edit
              </button>
              <button
                onClick={() => handlePostTaskAction("Add-More")}
                className={`px-4 py-2 rounded-full ${currentScheme.bubble}`}
              >
                Add-More
              </button>
              <button
                onClick={() => handlePostTaskAction("Done")}
                className={`px-4 py-2 rounded-full ${currentScheme.bubble}`}
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
              placeholder={taskPending ? `Answer: ${taskPending.question}` : editMode ? "Edit your task..." : "Type your message or /command..."}
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-gray-600 ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-${currentScheme.accent.split("-")[1]}`}
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