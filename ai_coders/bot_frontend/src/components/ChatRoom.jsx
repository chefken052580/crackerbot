// Version: v2025-04-01-10
/**
 * CrackerBot’s Cosmic Chatroom Component
 * Where interstellar ideas ignite and soar across the galaxy with supernova flair!
 * Enhanced by xAI for distinct user/task names, Redis reset on reconnect, and single-response workflow.
 *
 * @version 2025-04-01-10
 * @author CrackerBot Team, enhanced by xAI
 * @module ChatRoom
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import WebSocketManager from '../utils/WebSocketManager.js';
import ChatMessage from './ChatMessage.jsx';
import PreviewPopup from './PreviewPopup.jsx';
import { commands, colorSchemes } from '../config/chatConfig.js';

const WEBSOCKET_SERVER_URL =
  process.env.REACT_APP_WEBSOCKET_SERVER_URL || 'wss://websocket-visually-sterling-spider.ngrok-free.app';

/**
 * ChatRoom component managing the cosmic user interface and WebSocket connection.
 * @returns {JSX.Element} The chatroom UI with stellar interactivity
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
  const [userName, setUserName] = useState('Guest'); // Persistent user name
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const frontendIdRef = useRef(null);

  /**
   * Logs a message with timestamp for cosmic debugging.
   * @param {string} msg - Message to log
   * @private
   */
  const logMessage = useCallback((msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }, []);

  /**
   * Initializes the WebSocket connection with cosmic event handlers.
   * @private
   */
  const initializeSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = new WebSocketManager(WEBSOCKET_SERVER_URL, {
      onConnect: (id) => {
        frontendIdRef.current = id;
        logMessage(`🌌 WebSocket connected—cosmic ID: ${id}`);
        setIsConnected(true);
        socketRef.current.emit('register', { name: 'frontend', role: 'frontend', frontendId: id });
        socketRef.current.emit('frontend_connected', { ip: window.location.hostname, frontendId: id, userName });
        setMessages((prev) => [
          ...prev.filter((msg) => msg.type !== 'system' || !msg.text.includes('Reset and reconnected')),
          {
            id: `${Date.now()}-connect`,
            from: 'System',
            user: userName,
            text: 'CrackerBot’s galactic channels live—warp speed engaged! 🚀',
            type: 'system',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#333' },
          },
        ]);
      },
      onMessage: (data) => {
        logMessage(`🌠 Cosmic signal received: ${JSON.stringify(data)}`);
        if (data.frontendId && data.frontendId !== frontendIdRef.current) {
          logMessage(`Ignoring signal for frontendId ${data.frontendId}; current ID: ${frontendIdRef.current}`);
          return;
        }

        const messageId = data.messageId || `${data.taskId || Date.now()}-${data.type || 'unknown'}-${data.text?.slice(0, 50) || 'no-text'}`;
        const safeData = {
          text: typeof data.text === 'string' ? data.text : 'No cosmic transmission received',
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
          bubbleStyle: data.bubbleStyle || {},
          user: data.user || userName,
        };

        // Update userName only from initial name step success
        if (safeData.type === 'success' && safeData.taskId?.startsWith('initial') && safeData.user !== 'Guest' && safeData.user !== userName) {
          setUserName(safeData.user);
          logMessage(`🌟 User name updated to: ${safeData.user}`);
        }

        const newMessage = {
          id: messageId,
          from: safeData.from,
          user: safeData.user,
          text: safeData.text,
          type: safeData.type,
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
          bubbleStyle: safeData.bubbleStyle,
        };

        React.startTransition(() => {
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === messageId)) {
              logMessage(`✨ Duplicate message ignored: ${messageId}`);
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
                logMessage(`📈 Updated progress for task ${safeData.taskId}: ${safeData.progress}%`);
                return updatedMessages;
              }
            }
            logMessage(`🌟 Adding new message from ${safeData.from}: "${safeData.text}" (ID: ${messageId})`);
            return [...prev, newMessage];
          });

          if (safeData.type === 'question') {
            setTaskPending({ taskId: safeData.taskId, question: safeData.text, options: safeData.options });
            setCurrentTask((prev) => ({
              taskId: safeData.taskId,
              name: safeData.taskName || prev?.name || 'Pending',
              type: safeData.taskType || prev?.type || 'Pending',
              features: safeData.taskFeatures || prev?.features || 'Pending',
              step: safeData.text.toLowerCase().includes('name below') ? 'name' :
                    safeData.text.toLowerCase().includes('chat') || safeData.text.toLowerCase().includes('build') ? 'choice' :
                    safeData.text.toLowerCase().includes('tech') ? 'type' :
                    safeData.text.toLowerCase().includes('features') ? 'pending_features' : 'review',
              taskStatus: 'pending',
            }));
            logMessage(`❓ Task pending set: ${safeData.taskId} - "${safeData.text}"`);
          } else if (safeData.type === 'taskResult') {
            setTaskPending(null);
            setCurrentTask((prev) => prev ? { ...prev, taskStatus: 'completed', name: safeData.taskName, type: safeData.taskType, features: safeData.taskFeatures } : null);
            setEditMode(null);
            setTaskProgress((prev) => ({ ...prev, [safeData.taskId]: 100 }));
            logMessage(`✅ Task completed: ${safeData.taskId} - "${safeData.taskName}"`);
          } else if (safeData.type === 'success' && !safeData.projects) {
            setTaskPending(null);
            setCurrentTask(null);
            setEditMode(null);
            logMessage(`🌟 Success message received, task cleared`);
          } else if (safeData.type === 'error' && safeData.taskId) {
            setTaskPending(null);
            setCurrentTask(null);
            setEditMode(null);
            setTaskProgress((prev) => {
              const newProgress = { ...prev };
              delete newProgress[safeData.taskId];
              return newProgress;
            });
            logMessage(`⚠️ Error for task ${safeData.taskId}: "${safeData.text}"`);
          }

          setIsTyping((prev) => ({ ...prev, [safeData.from]: false }));
        });
      },
      onConnectError: (error) => {
        logMessage(`⚠️ Cosmic connect glitch: ${error.message}`);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-error`,
            from: 'System',
            user: userName,
            text: `Signal snag: ${error.message}—retrying warp connection! ⚡️`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          },
        ]);
        setIsConnected(false);
      },
      onDisconnect: (reason) => {
        logMessage(`⚠️ WebSocket lost in the void: ${reason}`);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-disconnect`,
            from: 'System',
            user: userName,
            text: `Cosmic link severed: ${reason}—realigning soon! 💥`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          },
        ]);
        setIsConnected(false);
      },
    });
  }, [taskProgress, userName, logMessage]);

  useEffect(() => {
    logMessage('🌌 Igniting cosmic chatroom—prepare for warp speed!');
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
   * Initializes the Matrix rain background effect with cosmic flair.
   * @private
   */
  const initMatrixRain = useCallback(() => {
    if (colorScheme !== 'matrix' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?🌌🚀';
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
   * Sends a message via WebSocket to the cosmic network.
   * @param {string} messageText - Text to transmit
   * @private
   */
  const sendMessage = useCallback((messageText) => {
    if (!socketRef.current || !messageText.trim() || !isConnected || isSending) return;

    setIsSending(true);
    const messageData = {
      text: messageText.trim(),
      type: messageText.startsWith('/') ? 'command' : 'task_response',
      frontendId: frontendIdRef.current,
      ip: window.location.hostname,
      target: 'bot_lead',
      user: userName,
    };

    const userMessage = {
      id: `${Date.now()}-${messageText.slice(0, 50)}`,
      from: 'You',
      user: userName,
      text: messageText.trim(),
      type: messageText.startsWith('/') ? 'command' : 'task_response',
      timestamp: new Date().toLocaleTimeString(),
      bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #00ccff)', color: '#000' },
    };
    setMessages((prev) => [...prev, userMessage]);
    logMessage(`📤 Sent message: "${messageText}" (type: ${messageData.type}, user: ${userName})`);

    if (messageText.startsWith('/')) {
      messageData.commandFlag = true;
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
            text: `🌟 Cosmic Command Codex:\n${commandList}`,
            type: 'system',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#333' },
          },
        ]);
      } else if (command === '/reset_name') {
        socketRef.current.emit('message', messageData);
        setCurrentTask({ taskId: `initial:${frontendIdRef.current}`, step: 'name', taskStatus: 'pending' });
        setUserName('Guest');
      } else {
        socketRef.current.emit('message', messageData);
      }
    } else {
      if (currentTask) {
        messageData.taskId = currentTask.taskId;
        if (currentTask.step === 'name' && !currentTask.taskName) {
          setUserName(messageText.trim());
          messageData.user = messageText.trim();
          setCurrentTask((prev) => ({ ...prev, step: 'choice' }));
        } else if (currentTask.step === 'project_name') {
          setCurrentTask((prev) => ({ ...prev, name: messageText.trim() }));
        }
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
  }, [isConnected, isSending, currentTask, userName, logMessage]);

  /**
   * Handles input changes and command filtering with stellar precision.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input event
   * @private
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
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keydown event
   * @private
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
   * Selects a command from the autocomplete list with cosmic flair.
   * @param {string} command - Selected command
   * @private
   */
  const handleCommandSelect = useCallback((command) => {
    setInput(command + ' ');
    setShowCommands(false);
    setCommandIndex(-1);
    inputRef.current?.focus();
  }, []);

  /**
   * Toggles speech recognition for voice input across the stars.
   * @private
   */
  const toggleRecording = useCallback(() => {
    if (!isRecording) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-mic-error`,
            from: 'System',
            user: userName,
            text: '🎤 Mic’s offline—type your cosmic will, star voyager!',
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
          },
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
            id: `${Date.now()}-mic-fail`,
            from: 'System',
            user: userName,
            text: `🎤 Mic malfunction: ${event.error === 'no-speech' ? 'Silence detected!' : event.error}. Type it out, cosmic creator!`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
            bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
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
  }, [isRecording, sendMessage, userName]);

  /**
   * Manually reconnects the WebSocket to the cosmic grid, resetting Redis user name.
   * @private
   */
  const manualReconnect = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.disconnect();
    socketRef.current.emit('reset_user', { userId: frontendIdRef.current, ip: window.location.hostname });
    setMessages([]);
    setTaskPending(null);
    setCurrentTask(null);
    setEditMode(null);
    setTaskProgress({});
    setUserName('Guest');
    initializeSocket();
    logMessage('🌠 Manual warp initiated—realigning to cosmic grid with fresh identity!');
  }, [initializeSocket, logMessage]);

  /**
   * Changes the color scheme with stellar aesthetics.
   * @param {string} scheme - New color scheme
   * @private
   */
  const handleColorChange = useCallback((scheme) => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
    logMessage(`🌟 Cosmic palette shifted to ${scheme}—galactic vibes refreshed!`);
  }, [logMessage]);

  /**
   * Handles option clicks from ChatMessage with cosmic precision.
   * @param {string} option - Selected option
   * @param {Object} [projectData] - Optional project data
   * @private
   */
  const handleOptionClick = useCallback((option, projectData) => {
    if (projectData) {
      const { taskId, content, fileName, user } = projectData.projectData || {};
      if (!taskId) return;

      if (option === 'Refine Project') {
        setCurrentTask({ taskId, step: 'pending_features', taskStatus: 'pending' });
        setTaskPending({ taskId, question: `Amplify "${projectData.text}" with supernova features!`, options: [] });
        socketRef.current.emit('message', {
          text: 'Refine Project',
          type: 'task_response',
          taskId,
          frontendId: frontendIdRef.current,
          ip: window.location.hostname,
          target: 'bot_lead',
          user: user || userName,
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
              user: user || userName,
              text: `🌌 Beaming "${projectData.text}" to your starship—cosmic loot secured! 📡`,
              type: 'system',
              timestamp: new Date().toLocaleTimeString(),
              bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
            },
          ]);
        }
      } else if (option === 'Delete') {
        socketRef.current.emit('message', {
          text: `/delete ${taskId}`,
          type: 'command',
          taskId,
          frontendId: frontendIdRef.current,
          ip: window.location.hostname,
          target: 'bot_lead',
          user: user || userName,
        });
      }
    } else {
      sendMessage(option);
      if (option === 'Restart' && currentTask) {
        socketRef.current.emit('message', {
          text: `/restart ${currentTask.taskId}`,
          type: 'command',
          taskId: currentTask.taskId,
          frontendId: frontendIdRef.current,
          ip: window.location.hostname,
          target: 'bot_lead',
          user: userName,
        });
        setEditMode(currentTask.taskId);
      } else if (option === 'Refine Project' && currentTask) {
        setCurrentTask((prev) => ({ ...prev, step: 'pending_features', taskStatus: 'pending' }));
        setTaskPending({ taskId: currentTask.taskId, question: `Enhance "${currentTask.name}" with galactic features!`, options: [] });
        socketRef.current.emit('message', {
          text: 'Refine Project',
          type: 'task_response',
          taskId: currentTask.taskId,
          frontendId: frontendIdRef.current,
          ip: window.location.hostname,
          target: 'bot_lead',
          user: userName,
        });
      } else if (option === 'Done' && currentTask) {
        const taskResult = messages.find((m) => m.taskId === currentTask.taskId && m.type === 'taskResult');
        socketRef.current.emit('message', {
          text: 'store_project',
          type: 'command',
          taskId: currentTask.taskId,
          frontendId: frontendIdRef.current,
          ip: window.location.hostname,
          target: 'bot_lead',
          user: userName,
          taskName: currentTask.name,
          taskType: currentTask.type,
          taskFeatures: currentTask.features,
          finalContent: taskResult?.finalContent,
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
  }, [currentTask, messages, sendMessage, userName, logMessage]);

  /**
   * Triggers preview popup for cosmic creations (unused in favor of ChatMessage handling).
   * @param {Object} msg - Message data
   * @private
   */
  const handlePreviewClick = useCallback((msg) => {
    setPreviewData({ fileContent: msg.finalContent, fileName: msg.fileName || `${msg.taskName || 'cosmic_download'}.zip`, taskId: msg.taskId });
    logMessage(`🌟 Preview warping in for task ${msg.taskId}: ${msg.fileName || msg.taskName}`);
  }, [logMessage]);

  /**
   * Closes the preview popup, returning to the cosmic chat.
   * @private
   */
  const closePreview = useCallback(() => {
    setPreviewData(null);
    logMessage('🌌 Preview faded—back to the cosmic hub!');
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
        <h2 className={`text-2xl font-bold ${currentScheme.accent}`}>
          🌌 CrackerBot Cosmic Hub {editMode ? '(Refining Stardust)' : ''} - {userName}
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
              <div key={msg.id} className="message-wrapper mb-2">
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
              <div key={user} className="text-gray-500 italic mb-2">
                {`${user} is forging cosmic wonders...`}
              </div>
            ))}
          </div>

          {currentTask && (
            <div className="text-[#00ff9f] my-2 font-mono">
              🌟 Task: {currentTask.name || 'Unnamed Epic'} | Type: {currentTask.type || 'TBD'} | Features: {currentTask.features || 'Forging...'}
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
                  ? currentTask.step === 'name' && !currentTask.taskName
                    ? '🌠 Claim your cosmic identity...'
                    : currentTask.step === 'choice'
                    ? '🌟 Choose your galactic path: Chat or Build-Something-Epic'
                    : currentTask.step === 'project_name'
                    ? '⚒️ Name your cosmic creation...'
                    : currentTask.step === 'type'
                    ? '✨ Select your tech constellation...'
                    : currentTask.step === 'pending_features'
                    ? '⚒️ Describe your stellar features...'
                    : `🌌 Answer: ${taskPending.question}`
                  : editMode
                  ? '🌠 Refine your interstellar masterpiece...'
                  : '🌌 Transmit your cosmic will or /command...'
              }
              className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-[#ff00ff] ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-[#00ff9f] focus:shadow-[0_0_10px_#00ff9f] transition-shadow`}
            />
            <button
              onClick={toggleRecording}
              className={`p-2 bg-gradient-to-r from-[#ff00ff] to-[#00ffff] hover:from-[#ff66ff] hover:to-[#66ffff] text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? 'scale-110' : ''}`}
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