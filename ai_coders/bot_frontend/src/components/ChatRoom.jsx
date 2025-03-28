// ai_coders/bot_frontend/src/components/ChatRoom.jsx
// Version: v2025-03-28-11
/* CrackerBot’s cosmic chatroom—where interstellar ideas ignite and take flight! 🌌 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import WebSocketManager from '../utils/WebSocketManager';
import ChatMessage from './ChatMessage';
import PreviewPopup from './PreviewPopup';
import { commands, colorSchemes } from '../config/chatConfig';

const WEBSOCKET_SERVER_URL =
  process.env.REACT_APP_WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

/**
 * ChatRoom component managing the user interface and WebSocket connection.
 * @returns {JSX.Element} The chatroom UI
 */
const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(commands);
  const [commandIndex, setCommandIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState({});
  const [taskPending, setTaskPending] = useState(null);
  const [currentTask, setCurrentTask] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [colorScheme, setColorScheme] = useState(localStorage.getItem('colorScheme') || 'neon');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [taskProgress, setTaskProgress] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const frontendIdRef = useRef(null); // Track current frontend ID

  /**
   * Logs a message with timestamp for debugging.
   * @param {string} msg - Message to log
   */
  const logMessage = useCallback((msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }, []);

  /**
   * Initializes the WebSocket connection with event handlers.
   */
  const initializeSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = new WebSocketManager(WEBSOCKET_SERVER_URL, {
      onConnect: (id) => {
        frontendIdRef.current = id; // Store frontend ID
        logMessage(`WebSocket connected, ID: ${id}`);
        setMessages((prev) => [
          ...prev.filter((msg) => msg.type !== 'system' || !msg.text.includes('Reset and reconnected')),
          { from: 'System', text: 'CrackerBot’s cosmic channels live—warp speed engaged! 🚀', type: 'system', timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(true);
        const userName = localStorage.getItem('userName') || 'Guest';
        socketRef.current.emit('register', { name: userName, role: 'frontend', frontendId: id, userName });
        socketRef.current.emit('frontend_connected', { ip: window.location.hostname, frontendId: id, userName });
      },
      onMessage: (data) => {
        logMessage(`Cosmic message received: ${JSON.stringify(data)}`);
        try {
          // Ignore messages not targeting this frontend
          if (data.frontendId && data.frontendId !== frontendIdRef.current) {
            logMessage(`Ignoring message for frontendId ${data.frontendId}; current ID is ${frontendIdRef.current}`);
            return;
          }

          const storedUserName = localStorage.getItem('userName') || 'Guest';
          const userName = data.user && data.user !== 'stranger' && data.user !== 'Guest' ? data.user : storedUserName;
          const messageId = data.messageId || `${data.taskId || Date.now()}-${data.type || 'unknown'}-${data.text?.slice(0, 50) || 'no-text'}`;

          // Ensure data has expected fields with defaults
          const safeData = {
            text: typeof data.text === 'string' ? data.text : 'No message content received',
            type: data.type || 'bot',
            from: data.from || 'CrackerBot Prime',
            taskId: data.taskId || null,
            options: Array.isArray(data.options) ? data.options : [],
            frontendId: data.frontendId || null,
            ip: data.ip || 'unknown',
            finalContent: data.finalContent || data.content || null,
            downloadLink: data.downloadLink || null,
            taskName: data.taskName || null,
            taskType: data.taskType || null,
            taskFeatures: data.taskFeatures || null,
            projects: data.projects || null,
            progress: typeof data.progress === 'number' ? data.progress : undefined,
          };

          const newMessage = {
            id: messageId,
            from: safeData.from,
            user: userName,
            text: safeData.text,
            type: safeData.type,
            fileName: safeData.fileName,
            finalContent: safeData.finalContent,
            downloadLink: safeData.downloadLink,
            taskId: safeData.taskId,
            options: safeData.options,
            timestamp: new Date().toLocaleTimeString(),
            frontendId: safeData.frontendId,
            taskName: safeData.taskName,
            taskType: safeData.taskType,
            taskFeatures: safeData.taskFeatures,
            projects: safeData.projects,
            progress: safeData.type === 'progressUpdate' ? safeData.progress : undefined,
            isBuilding: safeData.type === 'progressUpdate' || (safeData.taskId && taskProgress[safeData.taskId] < 100),
          };

          // Batch state updates to prevent render issues
          React.startTransition(() => {
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === messageId)) {
                logMessage(`Duplicate message skipped: ${messageId}`);
                return prev;
              }
              if (safeData.type === 'progressUpdate' && safeData.taskId) {
                setTaskProgress((prevProgress) => ({
                  ...prevProgress,
                  [safeData.taskId]: safeData.progress,
                }));
                const existingIdx = prev.findIndex((msg) => msg.taskId === safeData.taskId && msg.type === 'progressUpdate');
                if (existingIdx >= 0) {
                  const updatedMessages = [...prev];
                  updatedMessages[existingIdx] = { ...updatedMessages[existingIdx], ...newMessage };
                  logMessage(`Updated progress message for taskId: ${safeData.taskId}`);
                  return updatedMessages;
                }
                logMessage(`Added new progress message for taskId: ${safeData.taskId}`);
                return [...prev, newMessage];
              }
              logMessage(`Added new message: ${messageId}`);
              return [...prev, newMessage];
            });

            if (safeData.type === 'taskResult') {
              setTaskPending(null);
              setCurrentTask((prev) =>
                prev
                  ? { ...prev, taskStatus: 'completed', name: safeData.taskName, type: safeData.taskType, features: safeData.taskFeatures }
                  : null
              );
              setEditMode(null);
              setTaskProgress((prev) => ({
                ...prev,
                [safeData.taskId]: 100,
              }));
              logMessage(`Processed taskResult for taskId: ${safeData.taskId}`);
            } else if (safeData.type === 'success' && safeData.projects) {
              setTaskPending(null);
              setCurrentTask(null);
              setEditMode(null);
              logMessage(`Processed success with projects`);
            } else if (safeData.type === 'question' && safeData.taskId) {
              setTaskPending({ taskId: safeData.taskId, question: safeData.text, options: safeData.options });
              setCurrentTask((prev) => ({
                taskId: safeData.taskId,
                name: safeData.taskName || prev?.name || 'Pending',
                type: safeData.taskType || prev?.type || 'Pending',
                features: safeData.taskFeatures || prev?.features || 'Pending',
                step: safeData.text.toLowerCase().includes('name') && !localStorage.getItem('userName')
                  ? 'name'
                  : safeData.text.toLowerCase().includes('type')
                  ? 'type'
                  : safeData.text.toLowerCase().includes('features')
                  ? 'features'
                  : safeData.text.toLowerCase().includes('chat') || safeData.text.toLowerCase().includes('build')
                  ? 'choice'
                  : 'review',
                taskStatus: 'pending',
              }));
              setEditMode(safeData.taskId && safeData.text.toLowerCase().includes('restart') ? safeData.taskId : null);
              logMessage(`Processed question for taskId: ${safeData.taskId}`);
            } else if (safeData.type === 'success' && safeData.options) {
              setTaskPending(null);
              setCurrentTask((prev) => (prev ? { ...prev, step: 'choice' } : null));
              logMessage(`Processed success with options`);
            } else if (safeData.type === 'error' && safeData.taskId) {
              setTaskPending(null);
              setCurrentTask(null);
              setEditMode(null);
              setTaskProgress((prev) => {
                const newProgress = { ...prev };
                delete newProgress[safeData.taskId];
                return newProgress;
              });
              logMessage(`Processed error for taskId: ${safeData.taskId}`);
            }

            setIsTyping((prev) => ({ ...prev, [safeData.from]: false }));
            if (safeData.user && safeData.user !== storedUserName && safeData.user !== 'Guest' && safeData.user !== 'stranger') {
              localStorage.setItem('userName', safeData.user);
              logMessage(`Updated userName to ${safeData.user}`);
            }
          });
        } catch (err) {
          logMessage(`Error processing message: ${err.message}, Data: ${JSON.stringify(data)}`);
          setMessages((prev) => [
            ...prev,
            { 
              from: 'System', 
              text: `Cosmic glitch in message handling: ${err.message}—retrying connection! ⚡️`, 
              type: 'error', 
              timestamp: new Date().toLocaleTimeString() 
            },
          ]);
        }
      },
      onConnectError: (error) => {
        logMessage(`WebSocket connect error: ${error.message}`);
        setMessages((prev) => [
          ...prev,
          { from: 'System', text: `Cosmic glitch: ${error.message}—retrying connection! ⚡️`, type: 'error', timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(false);
      },
      onDisconnect: (reason) => {
        logMessage(`WebSocket disconnected: ${reason}`);
        setMessages((prev) => [
          ...prev,
          { from: 'System', text: `Signal lost: ${reason}—warping back online soon! 💥`, type: 'error', timestamp: new Date().toLocaleTimeString() },
        ]);
        setIsConnected(false);
      },
    });
  }, [taskProgress, logMessage]);

  useEffect(() => {
    logMessage('Igniting cosmic chatroom...');
    initializeSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [initializeSocket]);

  useEffect(() => {
    document.body.className = `${colorSchemes[colorScheme].bg} relative`;
    if (colorScheme === 'matrix') {
      document.body.style.backgroundImage = 'none';
      initMatrixRain();
    } else {
      document.body.style.backgroundImage = 'none';
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

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  /**
   * Initializes the Matrix rain background effect.
   */
  const initMatrixRain = useCallback(() => {
    if (colorScheme !== 'matrix' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 15, 10, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff85';
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

    let animationFrameId;
    const animate = () => {
      draw();
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drops.length = Math.floor(canvas.width / fontSize);
      drops.fill(1);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [colorScheme]);

  /**
   * Sends a message via WebSocket.
   * @param {string} messageText - Text to send
   */
  const sendMessage = useCallback((messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected || isSending) return;

    setIsSending(true);
    const userName = localStorage.getItem('userName') || 'Guest';
    const messageData = {
      text: messageText.trim(),
      user: userName,
      userId: socketRef.current.id,
      ip: window.location.hostname,
      frontendId: socketRef.current.id,
    };

    const userMessage = {
      id: `${Date.now()}-${messageText.slice(0, 50)}`,
      from: userName,
      user: userName,
      text: messageText.trim(),
      type: messageText.startsWith('/') ? 'command' : 'user',
      timestamp: new Date().toLocaleTimeString(),
      className: 'user-message' + (messageText.startsWith('/') ? ' command' : ''),
      taskId: currentTask?.taskId,
    };
    setMessages((prev) => [...prev, userMessage]);

    if (messageText.startsWith('/')) {
      messageData.type = 'command';
      messageData.commandFlag = true;
      messageData.target = 'bot_lead';
      const commandParts = messageText.split(' ');
      const command = commandParts[0].toLowerCase();

      if (command === '/commands') {
        const commandList = commands.map((cmd) => `${cmd.command}: ${cmd.description}`).join('\n');
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-commands`,
            from: 'System',
            user: userName,
            text: `Cosmic Command Codex:\n${commandList}`,
            type: 'system',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } else {
        switch (command) {
          case '/reset_name':
            localStorage.removeItem('userName');
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-reset_name`,
                from: 'System',
                user: userName,
                text: 'Identity vaporized—forge a new cosmic alias! 🌟',
                type: 'system',
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            setCurrentTask({ taskId: `initial_name:${socketRef.current.id}`, step: 'name', taskStatus: 'pending' });
            break;
          case '/delete':
            if (commandParts.length < 2) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-delete_error`,
                  from: 'CrackerBot Prime',
                  user: userName,
                  text: `Yo ${userName}, pick a target to obliterate! Use /delete <taskId>—scope /projects for IDs. 💥`,
                  type: 'error',
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
              break;
            }
            break;
          default:
            socketRef.current.emit('message', messageData);
            break;
        }
      }
    } else {
      const lastWelcome = messages.find((m) => m.type === 'success' && m.options && m.taskId);
      if (currentTask && currentTask.taskStatus !== 'completed') {
        messageData.type = 'task_response';
        messageData.taskId = currentTask.taskId;
        if (currentTask.step === 'name' && !localStorage.getItem('userName')) {
          localStorage.setItem('userName', messageText.trim());
          messageData.user = messageText.trim();
          setCurrentTask((prev) => ({ ...prev, step: 'choice' }));
        } else if (currentTask.step === 'features') {
          setCurrentTask((prev) => ({ ...prev, features: messageText.trim() }));
          setTaskProgress((prev) => ({ ...prev, [currentTask.taskId]: 0 }));
          setMessages((prev) => {
            const existingIdx = prev.findIndex((msg) => msg.taskId === currentTask.taskId && msg.type === 'progressUpdate');
            if (existingIdx >= 0) {
              const updatedMessages = [...prev];
              updatedMessages[existingIdx] = {
                ...updatedMessages[existingIdx],
                id: `${Date.now()}-progress`,
                from: 'CrackerBot Prime',
                text: 'CrackerBot’s forging your cosmic creation! 🌠',
                type: 'progressUpdate',
                taskId: currentTask.taskId,
                progress: 0,
                isBuilding: true,
                timestamp: new Date().toLocaleTimeString(),
              };
              return updatedMessages;
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-progress`,
                from: 'CrackerBot Prime',
                text: 'CrackerBot’s forging your cosmic creation! 🌠',
                type: 'progressUpdate',
                taskId: currentTask.taskId,
                progress: 0,
                isBuilding: true,
                timestamp: new Date().toLocaleTimeString(),
              },
            ];
          });
        }
        messageData.features = currentTask?.features || messageText.trim();
      } else if (lastWelcome && (messageText === 'Chat' || messageText === 'Build-Something-Epic')) {
        messageData.type = 'task_response';
        messageData.taskId = lastWelcome.taskId;
      } else {
        messageData.type = 'general_message';
      }
      socketRef.current.emit('message', messageData);
    }

    setInput('');
    setShowCommands(false);
    setCommandIndex(-1);
    setTimeout(() => {
      setIsSending(false);
      inputRef.current?.focus();
    }, 100);
  }, [isConnected, isSending, currentTask, messages, logMessage]);

  /**
   * Handles input changes and command filtering.
   * @param {Object} e - Input event
   */
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith('/')) {
      const query = value.slice(1).toLowerCase();
      const filtered = commands.filter((cmd) => cmd.command.toLowerCase().startsWith(query));
      setFilteredCommands(filtered);
      setShowCommands(true);
      setCommandIndex(filtered.length > 0 ? 0 : -1);
    } else {
      setShowCommands(false);
      setCommandIndex(-1);
    }
  }, []);

  /**
   * Handles keydown events for input and command selection.
   * @param {Object} e - Keydown event
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (showCommands && commandIndex >= 0) {
        const selectedCommand = filteredCommands[commandIndex].command;
        setInput(selectedCommand + ' ');
        setShowCommands(false);
        setCommandIndex(-1);
        inputRef.current?.focus();
      } else {
        sendMessage(input);
      }
    } else if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (commandIndex >= 0) {
          const selectedCommand = filteredCommands[commandIndex].command;
          setInput(selectedCommand + ' ');
          setShowCommands(false);
          setCommandIndex(-1);
          inputRef.current?.focus();
        }
      }
    }
  }, [input, showCommands, commandIndex, filteredCommands, sendMessage]);

  /**
   * Selects a command from the autocomplete list.
   * @param {string} command - Selected command
   */
  const handleCommandSelect = useCallback((command) => {
    setInput(command + ' ');
    setShowCommands(false);
    setCommandIndex(-1);
    inputRef.current?.focus();
  }, []);

  /**
   * Toggles speech recognition for voice input.
   */
  const toggleRecording = useCallback(() => {
    if (!isRecording) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMessages((prev) => [
          ...prev,
          { from: 'System', text: 'Mic’s offline—type it out, cosmic voyager! 🎹', type: 'error', timestamp: new Date().toLocaleTimeString() },
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
            from: 'System',
            text: `Mic malfunction: ${event.error === 'no-speech' ? 'Silence detected!' : event.error}. Back to typing!`,
            type: 'error',
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
  }, [isRecording, sendMessage]);

  /**
   * Manually reconnects the WebSocket.
   */
  const manualReconnect = useCallback(() => {
    if (!socketRef.current) return;
    const oldUserId = socketRef.current.id;
    const ip = window.location.hostname;
    localStorage.removeItem('userName');
    socketRef.current.emit('reset_user', { userId: oldUserId, ip });
    socketRef.current.disconnect();
    setMessages([]);
    setTaskPending(null);
    setCurrentTask(null);
    setEditMode(null);
    setTaskProgress({});
    initializeSocket();
    logMessage('Manual reconnect initiated—warping back to cosmic grid!');
  }, [initializeSocket, logMessage]);

  /**
   * Changes the color scheme.
   * @param {string} scheme - New color scheme
   */
  const handleColorChange = useCallback((scheme) => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
    logMessage(`Color scheme switched to ${scheme}—cosmic vibes refreshed!`);
  }, [logMessage]);

  /**
   * Handles option clicks from ChatMessage.
   * @param {string} option - Selected option
   * @param {Object} [projectData] - Optional project data
   */
  const handleOptionClick = useCallback((option, projectData) => {
    const userName = localStorage.getItem('userName') || 'Guest';
    if (projectData) {
      const { taskId, content, fileName } = projectData.projectData || {};
      if (!taskId) return;

      if (option === 'Refine Project') {
        setCurrentTask({ taskId, step: 'pending_features', taskStatus: 'pending' });
        setTaskPending({ taskId, question: `Add supernova features to "${projectData.text}"!`, options: [] });
        socketRef.current.emit('message', {
          text: 'Refine Project',
          type: 'task_response',
          taskId,
          frontendId: socketRef.current.id,
          user: userName,
          userId: socketRef.current.id,
          ip: window.location.hostname,
          commandFlag: true,
          target: 'bot_lead',
        });
      } else if (option === 'Download') {
        if (content && fileName) {
          const link = document.createElement('a');
          link.href = `data:application/zip;base64,${content}`;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-download`,
              from: 'System',
              user: userName,
              text: `Beaming down "${projectData.text}"—snag your cosmic loot! 📡`,
              type: 'system',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      } else if (option === 'Delete') {
        socketRef.current.emit('message', {
          text: `/delete ${taskId}`,
          type: 'command',
          taskId,
          frontendId: socketRef.current.id,
          user: userName,
          userId: socketRef.current.id,
          ip: window.location.hostname,
          commandFlag: true,
          target: 'bot_lead',
        });
      }
    } else {
      sendMessage(option);
      if (option === 'Restart' && currentTask) {
        socketRef.current.emit('message', {
          text: `/restart ${currentTask.taskId}`,
          type: 'command',
          commandFlag: true,
          target: 'bot_lead',
          taskId: currentTask.taskId,
          user: userName,
          frontendId: socketRef.current.id,
          ip: window.location.hostname,
        });
        setEditMode(currentTask.taskId);
      } else if (option === 'Refine Project' && currentTask) {
        setCurrentTask((prev) => ({ ...prev, step: 'pending_features', taskStatus: 'pending' }));
        setTaskPending({ taskId: currentTask.taskId, question: `Add supernova features to "${currentTask.name}"!`, options: [] });
        socketRef.current.emit('message', {
          text: 'Refine Project',
          type: 'task_response',
          taskId: currentTask.taskId,
          frontendId: socketRef.current.id,
          user: userName,
          userId: socketRef.current.id,
          ip: window.location.hostname,
          commandFlag: true,
          target: 'bot_lead',
        });
      } else if (option === 'Done' && currentTask) {
        socketRef.current.emit('message', {
          text: 'store_project',
          type: 'command',
          commandFlag: true,
          target: 'bot_lead',
          taskId: currentTask.taskId,
          user: userName,
          frontendId: socketRef.current.id,
          ip: window.location.hostname,
          taskName: currentTask.name,
          taskType: currentTask.type,
          taskFeatures: currentTask.features,
          finalContent: messages.find((m) => m.taskId === currentTask.taskId && m.type === 'taskResult')?.finalContent,
        });
        setCurrentTask(null);
        setTaskPending(null);
        setEditMode(null);
        setTaskProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[currentTask.taskId];
          return newProgress;
        });
      }
    }
  }, [currentTask, messages, sendMessage, logMessage]);

  /**
   * Triggers preview popup.
   * @param {string} fileContent - File content
   * @param {string} fileName - File name
   * @param {string} taskId - Task ID
   */
  const handlePreviewClick = useCallback((fileContent, fileName, taskId) => {
    setPreviewData({ fileContent, fileName, taskId });
    logMessage(`Preview requested for task ${taskId}: ${fileName}`);
  }, [logMessage]);

  /**
   * Closes the preview popup.
   */
  const closePreview = useCallback(() => {
    setPreviewData(null);
    logMessage('Preview closed—returning to cosmic chat!');
  }, [logMessage]);

  const currentScheme = colorSchemes[colorScheme];

  return (
    <div className={`flex flex-col h-full ${currentScheme.bg} ${currentScheme.text} overflow-hidden relative`}>
      {colorScheme === 'matrix' && (
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" />
      )}
      {previewData && (
        <PreviewPopup
          fileContent={previewData.fileContent}
          fileName={previewData.fileName}
          onClose={closePreview}
          socket={socketRef.current}
          postTaskOptions={{
            taskId: previewData.taskId,
            taskName: currentTask?.name,
            taskType: currentTask?.type,
            taskFeatures: currentTask?.features,
          }}
          setMessages={setMessages}
        />
      )}
      <div className="flex-shrink-0 p-4 flex justify-between items-center relative z-10">
        <h2 className={`text-2xl font-bold ${currentScheme.accent} animate-text-glow`}>
          CrackerBot Cosmic Hub {editMode ? '(Refining Mode)' : ''}
        </h2>
        <div className="flex space-x-2">
          <select
            value={colorScheme}
            onChange={(e) => handleColorChange(e.target.value)}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:shadow-neon transition-shadow`}
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
            {isRecording ? '🎙️' : '🎤'}
          </button>
          <button
            onClick={manualReconnect}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
          >
            Warp Reconnect
          </button>
          <button
            onClick={() => {
              const transcript = messages.map((msg) => `${msg.timestamp} ${msg.from}: ${msg.text}`).join('\n');
              const blob = new Blob([transcript], { type: 'text/plain' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `cosmic_log_${new Date().toISOString().replace(/:/g, '-')}.txt`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }}
            className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
          >
            Export Cosmic Log
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className={`w-full max-w-3xl flex flex-col h-[80vh] max-h-[80vh] mx-4 ${editMode ? 'border-2 border-[#00ff9f] shadow-[0_0_15px_#00ff9f]' : ''}`}>
          <div
            ref={chatContainerRef}
            className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto`}
          >
            {messages.map((msg) => (
              <div key={msg.id} className="message-wrapper mb-2 animate-fade-in">
                <ChatMessage
                  message={msg}
                  taskResult={msg.type === 'taskResult' ? msg : null}
                  onOptionClick={handleOptionClick}
                  colorScheme={currentScheme}
                  progress={taskProgress[msg.taskId]}
                  setMessages={setMessages}
                  socket={socketRef.current}
                />
              </div>
            ))}
            {Object.entries(isTyping).map(([user, typing]) => typing && (
              <div key={user} className="text-gray-500 italic animate-pulse mb-2">{`${user} is weaving cosmic code...`}</div>
            ))}
          </div>

          {currentTask && (
            <div className="text-[#00ff9f] my-2 font-mono animate-text-glow">
              Task: {currentTask.name || 'Unnamed Epic'} | Type: {currentTask.type || 'TBD'} | Features: {currentTask.features || 'Forging...'}
            </div>
          )}

          {showCommands && (
            <div
              ref={commandsRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={`absolute bottom-12 left-0 w-full max-w-3xl ${currentScheme.chatBg} border border-[#ff00ff] rounded-md shadow-[0_0_10px_#ff00ff] p-2 z-20 max-h-64 overflow-y-auto`}
            >
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <div
                    key={cmd.command}
                    onClick={() => handleCommandSelect(cmd.command)}
                    className={`cursor-pointer p-2 rounded-md ${idx === commandIndex ? 'bg-gray-600' : 'hover:bg-gray-700'} transition-colors`}
                  >
                    <span className={`${currentScheme.accent} font-bold`}>{cmd.command}</span> - {cmd.description}
                  </div>
                ))
              ) : (
                <div className="p-2 text-gray-500">No cosmic commands match your query</div>
              )}
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
                  ? currentTask.step === 'features'
                    ? `Task Features: ${currentTask.features || 'Type your cosmic vision!'}` 
                    : `Answer: ${taskPending.question}`
                  : editMode
                  ? 'Tweak your interstellar masterpiece...'
                  : 'Beam your message or /command...'
              }
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-[#ff00ff] ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-[#00ff9f] focus:shadow-[0_0_10px_#00ff9f] transition-shadow`}
            />
            <button
              onClick={toggleRecording}
              className={`p-2 bg-gradient-to-r from-[#ff00ff] to-[#00ffff] hover:from-[#ff66ff] hover:to-[#66ffff] text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? 'scale-110 animate-pulse' : ''}`}
            >
              🎙️
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!isConnected || !input.trim() || isSending}
              className={`px-4 py-2 rounded-r-md transition ${
                isConnected && input.trim() && !isSending
                  ? `${currentScheme.button} ${currentScheme.buttonText} hover:shadow-neon`
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              Warp Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;