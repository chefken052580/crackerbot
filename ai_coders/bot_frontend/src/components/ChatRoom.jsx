// bot_frontend/src/components/ChatRoom.jsx
// Version: v2025-07-30-06
/**
 * ChatRoom Component
 * The cosmic interface for CrackerBot, handling user interactions and WebSocket messages.
 * Enhanced by xAI for robust session persistence, error handling, UI resilience, stable WebSocket management,
 * single frontend_connected emission, prevention of duplicate name prompts, sessionId unlock during /warp_reconnect,
 * fixed input field disabling issue, added connection status feedback, message queuing during disconnection,
 * local welcome prompt on initial load, fixed 'cold undefined' error, fixed null wsRef error,
 * restored Warp Reconnect button with confirmation, fixed typo in onMessage, and added fallback for choice prompt.
 *
 * @version 2025-07-30-06
 * @author CrackerBot Team, enhanced by xAI
 * @module ChatRoom
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import WebSocketManager from '../utils/WebSocketManager.js';
import ChatMessage from './ChatMessage.jsx';
import PreviewPopup from './PreviewPopup.jsx';
import { commands, colorSchemes } from '../config/chatConfig.js';

/**
 * Error boundary component to catch and display rendering errors in ChatMessage.
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[${new Date().toISOString()}] 💥 Error in ChatMessage:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 p-2 border border-red-500 rounded mb-2">
          <p>⚠️ Cosmic interference in message rendering.</p>
          <p>{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Main chatroom component for CrackerBot Cosmic Hub.
 * @returns {JSX.Element} The rendered chatroom UI
 */
export function ChatRoom() {
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
  const [userName, setUserName] = useState(localStorage.getItem('crackerBotUserName') || 'Guest');
  const [messageIds, setMessageIds] = useState(new Set());
  const [persistentMessages, setPersistentMessages] = useState([]);
  const [frontendId] = useState(localStorage.getItem('frontendId') || crypto.randomUUID());
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId') || crypto.randomUUID());
  const [error, setError] = useState(null);
  const [welcomeCount, setWelcomeCount] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionLock, setConnectionLock] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  const chatContainerRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const initialLoadRef = useRef(true);

  /**
   * Debounces WebSocket events to prevent UI flooding.
   */
  const debounce = useCallback((fn, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }, []);

  /**
   * Scrolls to the bottom of the chat container.
   */
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  /**
   * Initializes WebSocket with stable singleton instance and prevents duplicates.
   */
  const initializeWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.isInitialized && wsRef.current.isConnected()) {
      console.log(`[${new Date().toISOString()}] 🔄 ChatRoom: WebSocket already initialized and connected, skipping`);
      setConnectionStatus('Connected');
      return;
    }

    if (connectionLock) {
      console.log(`[${new Date().toISOString()}] 🔒 ChatRoom: Connection locked, skipping initialization`);
      return;
    }

    setConnectionLock(true);
    setConnectionStatus('Connecting...');

    try {
      wsRef.current = new WebSocketManager(process.env.REACT_APP_WEBSOCKET_URL || 'wss://<your-ngrok-websocket-url>.ngrok-free.app', {
        onConnect: debounce((receivedFrontendId) => {
          console.log(`[${new Date().toISOString()}] 🌌 ChatRoom: Connected to cosmic relay: frontendId: ${receivedFrontendId}, sessionId: ${sessionId}, userName: ${userName}`);
          if (receivedFrontendId !== frontendId) {
            localStorage.setItem('frontendId', receivedFrontendId);
          }
          setIsConnected(true);
          setError(null);
          setConnectionStatus('Connected');
          setReconnectAttempts(0);
          setConnectionLock(false);
          wsRef.current.emit('frontend_connected', {
            ip: window.location.hostname,
            frontendId,
            userName,
            sessionId,
          });
          scrollToBottom();
        }, 1000),
        onMessage: debounce((data) => {
          try {
            if (Array.isArray(data)) data = data[0];
            if (!data || !data.text || (data.frontendId && data.frontendId !== frontendId)) {
              console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: Invalid or mismatched message received:`, data);
              return;
            }

            const messageId = data.messageId || `${data.taskId || Date.now()}-${data.type || 'unknown'}-${data.text?.slice(0, 50) || 'no-text'}`;
            const timestamp = data.timestamp || new Date().toISOString();
            const isWelcome = data.taskId?.startsWith('initial') && data.type === 'question' && data.options?.includes('Type your name below!');

            const dedupeKey = isWelcome ? `welcome-${data.taskId}-${data.user || 'Guest'}-${timestamp}` : messageId;
            if (messageIds.has(dedupeKey)) {
              console.log(`[${new Date().toISOString()}] 🔄 ChatRoom: Duplicate message ignored: ${dedupeKey}, text: ${data.text}`);
              return;
            }

            setMessageIds((prevIds) => new Set(prevIds).add(dedupeKey));

            const safeData = {
              text: typeof data.text === 'string' ? data.text : 'No cosmic transmission received',
              type: data.type || 'bot',
              from: data.from || 'CrackerBot Prime',
              taskId: data.taskId || `initial:${frontendId}`,
              options: Array.isArray(data.options) ? data.options : [],
              frontendId: data.frontendId || frontendId,
              ip: data.ip || 'unknown',
              finalContent: data.finalContent || data.content || null,
              downloadLink: data.downloadLink || null,
              taskName: data.taskName || null,
              taskType: data.taskType || null,
              taskFeatures: data.taskFeatures || null,
              projects: data.projects || null,
              progress: typeof data.progress === 'number' ? data.progress : undefined,
              bubbleStyle: data.bubbleStyle || { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
              user: data.user || userName,
              timestamp: new Date(timestamp).toLocaleTimeString(),
            };

            const newMessage = {
              id: dedupeKey,
              from: safeData.from,
              user: safeData.user,
              text: safeData.text,
              type: safeData.type,
              finalContent: safeData.finalContent,
              downloadLink: safeData.downloadLink,
              taskId: safeData.taskId,
              options: safeData.options,
              timestamp: safeData.timestamp,
              frontendId: sustainableData.frontendId,
              taskName: safeData.taskName,
              taskType: safeData.taskType || null,
              taskFeatures: safeData.taskFeatures || null,
              projects: data.projects || null,
              progress: safeData.type === 'progressUpdate' ? safeData.progress : taskProgress[safeData.taskId] || 0,
              isBuilding: safeData.type === 'building' || safeData.type === 'progressUpdate' || (safeData.taskId && (taskProgress[safeData.taskId] || 0) < 100),
              bubbleStyle: safeData.bubbleStyle,
            };

            setMessages((prev) => {
              if (isWelcome && safeData.options.includes('Type your name below!')) {
                if (welcomeCount >= 3) {
                  console.log(`[${new Date().toISOString()}] ⚠️ ChatRoom: Suppressing welcome message due to excessive welcomes`);
                  return prev;
                }
                setWelcomeCount((prev) => prev + 1);
                setCurrentTask({ taskId: safeData.taskId, step: 'name', taskStatus: 'pending' });
                setTaskPending({ taskId: safeData.taskId, question: safeData.text, options: safeData.options });
              }
              const updatedPrev = isWelcome && safeData.options.includes('Type your name below!')
                ? prev.filter((msg) => !msg.id.includes('welcome-') || msg.id === dedupeKey)
                : prev;

              if (safeData.type === 'building' || safeData.type === 'progressUpdate') {
                if (safeData.taskId) {
                  setTaskProgress((prevProgress) => ({
                    ...prevProgress,
                    [safeData.taskId]: safeData.progress !== undefined ? safeData.progress : prevProgress[safeData.taskId] || 0,
                  }));
                  const existingIdx = updatedPrev.findIndex((msg) => msg.taskId === safeData.taskId && (msg.type === 'building' || msg.type === 'progressUpdate'));
                  if (existingIdx >= 0) {
                    const updatedMessages = [...updatedPrev];
                    updatedMessages[existingIdx] = { ...updatedMessages[existingIdx], ...newMessage, progress: taskProgress[safeData.taskId] || safeData.progress || 0 };
                    return updatedMessages;
                  }
                }
              }

              const updatedMessages = [...updatedPrev, newMessage];
              if (safeData.type === 'question' || safeData.from === 'You') {
                setPersistentMessages((prevPersistent) => {
                  const newPersistent = [...prevPersistent.filter((msg) => msg.id !== dedupeKey), newMessage];
                  return newPersistent.length > 50 ? newPersistent.slice(-50) : newPersistent;
                });
              }
              return updatedMessages;
            });

            if (safeData.type === 'success' && safeData.taskId?.startsWith('initial') && safeData.user !== 'Guest' && safeData.user !== userName) {
              setUserName(safeData.user);
              localStorage.setItem('crackerBotUserName', safeData.user);
              if (wsRef.current) {
                wsRef.current.setUserName(safeData.user);
              }
              console.log(`[${new Date().toISOString()}] 🌟 ChatRoom: Updated userName to ${safeData.user}`);
              setCurrentTask({ taskId: safeData.taskId, step: 'choice', taskStatus: 'pending' });
              if (!isConnected) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `choice-${safeData.taskId}-${Date.now()}`,
                    from: 'System',
                    user: safeData.user,
                    text: `🌟 Welcome, ${safeData.user}! Choose your galactic path!`,
                    type: 'question',
                    taskId: safeData.taskId,
                    options: ['Chat', 'Build-Something-Epic'],
                    timestamp: new Date().toLocaleTimeString(),
                    bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
                  },
                ]);
                setTaskPending({
                  taskId: safeData.taskId,
                  question: `Choose your galactic path!`,
                  options: ['Chat', 'Build-Something-Epic'],
                });
              }
            }

            if (safeData.type === 'taskResult' && safeData.taskId) {
              setTaskPending(null);
              setCurrentTask((prev) => prev ? {
                ...prev,
                taskStatus: 'completed',
                name: safeData.taskName || prev.name,
                type: safeData.taskType || prev.type,
                features: safeData.taskFeatures || prev.features,
              } : null);
              setEditMode(null);
              setTaskProgress((prev) => ({ ...prev, [safeData.taskId]: 100 }));
              if (safeData.finalContent && safeData.downloadLink) {
                setPreviewData({
                  fileContent: safeData.finalContent,
                  fileName: `${safeData.taskName || 'cosmic_project'}.zip`,
                  taskId: safeData.taskId,
                });
              }
            } else if (safeData.type === 'pending' && safeData.taskId) {
              setCurrentTask((prev) => ({
                taskId: safeData.taskId,
                name: safeData.taskName || prev?.name || 'Unnamed Epic',
                type: safeData.taskType || prev?.type || 'TBD',
                features: safeData.taskFeatures || prev?.features || 'Forging cosmic brilliance...',
                step: 'type',
                taskStatus: 'pending',
              }));
            } else if (safeData.type === 'building' && safeData.taskId) {
              setCurrentTask((prev) => ({
                taskId: safeData.taskId,
                name: safeData.taskName || prev?.name || 'Unnamed Epic',
                type: safeData.taskType || prev?.type || 'TBD',
                features: safeData.taskFeatures || prev?.features || 'Forging cosmic brilliance...',
                step: 'building',
                taskStatus: 'building',
              }));
              setTaskPending(null);
            } else if (safeData.type === 'progressUpdate' && safeData.taskId) {
              setTaskProgress((prev) => ({
                ...prev,
                [safeData.taskId]: safeData.progress,
              }));
              setCurrentTask((prev) => prev?.taskId === safeData.taskId ? { ...prev, taskStatus: 'building' } : prev);
            } else if (safeData.type === 'question') {
              setTaskPending({ taskId: safeData.taskId, question: safeData.text, options: safeData.options });
              setCurrentTask((prev) => {
                const step = safeData.options.includes('Type your name below!') ? 'name' :
                  safeData.options.includes('Chat') && safeData.options.includes('Build-Something-Epic') ? 'choice' :
                  safeData.options.some(opt => ['mainnet-beta', 'testnet', 'devnet', 'none'].includes(opt)) ? 'network' :
                  safeData.options.includes('Type your feature details!') ? 'pending_features' :
                  safeData.options.includes('Name your project!') ? 'project_name' :
                  safeData.options.some(opt => ['Restart', 'Refine Project', 'Done'].includes(opt)) ? 'review' : 'unknown';
                return {
                  taskId: safeData.taskId,
                  name: safeData.taskName || prev?.name || 'Unnamed Epic',
                  type: safeData.taskType || prev?.type || 'TBD',
                  features: safeData.taskFeatures || prev?.features || 'Forging cosmic brilliance...',
                  step,
                  taskStatus: 'pending',
                };
              });
            } else if (safeData.type === 'success') {
              setTaskPending(null);
              if (safeData.taskId?.startsWith('initial')) {
                setCurrentTask((prev) => prev ? { ...prev, step: 'choice' } : { step: 'choice', taskId: safeData.taskId });
              } else {
                setCurrentTask(null);
              }
              setEditMode(null);
            } else if (safeData.type === 'error' && safeData.taskId) {
              setTaskPending(null);
              setCurrentTask((prev) => prev && prev.taskId === safeData.taskId ? { ...prev, taskStatus: 'error' } : null);
              setEditMode(null);
              setTaskProgress((prev) => {
                const newProgress = { ...prev };
                delete newProgress[safeData.taskId];
                return newProgress;
              });
            }

            setIsTyping((prev) => ({ ...prev, [safeData.from]: false }));
            scrollToBottom();
          } catch (err) {
            console.error(`[${new Date().toISOString()}] 💥 ChatRoom: Message processing error: ${err.message}`);
            setError(`Cosmic static detected: ${err.message}. Please try again.`);
          }
        }, 300),
        onTyping: (data) => {
          if (data.frontendId && data.frontendId !== frontendId) return;
          setIsTyping((prev) => ({ ...prev, 'CrackerBot Prime': true }));
          setTimeout(() => setIsTyping((prev) => ({ ...prev, 'CrackerBot Prime': false })), 2000);
        },
        onConnectError: (err) => {
          console.error(`[${new Date().toISOString()}] 💥 ChatRoom: Connection error: ${err.message}`);
          setIsConnected(false);
          setConnectionStatus(`Connection failed: ${err.message}`);
          setError(`Galactic link fractured: ${err.message}. Reconnecting...`);
          setConnectionLock(false);
        },
        onDisconnect: (reason) => {
          console.log(`[${new Date().toISOString()}] ⚡️ ChatRoom: Disconnected: ${reason}`);
          setIsConnected(false);
          setConnectionStatus(`Disconnected: ${reason}`);
          setError(`Ejected from cosmic grid—Reason: ${reason}. Reconnecting...`);
          setConnectionLock(false);
        },
      });

      wsRef.current.isInitialized = true;
      if (wsRef.current) {
        wsRef.current.setUserName(userName);
        wsRef.current.initializeSocket();
      }
      console.log(`[${new Date().toISOString()}] 🌌 ChatRoom: WebSocket initialization attempted with URL: ${process.env.REACT_APP_WEBSOCKET_URL || 'wss://<your-ngrok-websocket-url>.ngrok-free.app'}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] 💥 ChatRoom: WebSocket initialization failed: ${err.message}`);
      setError(`Failed to initialize cosmic relay: ${err.message}. Reconnecting...`);
      setConnectionStatus(`Initialization failed: ${err.message}`);
      setConnectionLock(false);
    }
  }, [frontendId, userName, sessionId, scrollToBottom, welcomeCount, debounce, connectionLock, isConnected]);

  /**
   * Initializes local welcome prompt if no connection is established.
   */
  const initializeLocalWelcome = useCallback(() => {
    if (messages.length === 0 && !isConnected) {
      const taskId = `initial:${frontendId}`;
      const welcomeMsg = {
        id: `welcome-${taskId}-${Date.now()}`,
        from: 'System',
        user: userName,
        text: `🌌 Cosmic channels aligning—welcome, ${userName === 'Guest' ? 'Guest' : userName}! Carve your legacy in the stars!`,
        type: 'question',
        taskId,
        options: userName === 'Guest' ? ['Type your name below!'] : ['Chat', 'Build-Something-Epic'],
        timestamp: new Date().toLocaleTimeString(),
        bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
      };
      setMessages([welcomeMsg]);
      setMessageIds(new Set([welcomeMsg.id]));
      setCurrentTask({ taskId, step: userName === 'Guest' ? 'name' : 'choice', taskStatus: 'pending' });
      setTaskPending({ taskId, question: welcomeMsg.text, options: welcomeMsg.options });
      scrollToBottom();
    }
  }, [frontendId, scrollToBottom, isConnected, messages.length, userName]);

  /**
   * Handles warp reconnect to reset user state and prompt for a new name.
   */
  const handleWarpReconnect = useCallback(() => {
    if (isSending) return;
    const confirmReset = window.confirm(
      '⚠️ Warning: This will reset your username to "Guest" and clear all completed tasks from the cosmic archives. Ready to warp anew?'
    );
    if (!confirmReset) return;

    const newSessionId = crypto.randomUUID();
    const taskId = `initial:${frontendId}`;
    setIsSending(true);
    if (wsRef.current) {
      wsRef.current.unlockSessionId();
      wsRef.current.emit('message', {
        text: '/warp_reconnect',
        type: 'command',
        commandFlag: true,
        frontendId,
        ip: window.location.hostname,
        target: 'bot_lead',
        user: userName,
        sessionId: newSessionId,
        taskId,
      });
    }

    setMessages([]);
    setTaskPending(null);
    setCurrentTask({ taskId, step: 'name', taskStatus: 'pending' });
    setEditMode(null);
    setTaskProgress({});
    setUserName('Guest');
    localStorage.setItem('crackerBotUserName', 'Guest');
    setMessageIds(new Set());
    setPersistentMessages([]);
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
    setError(null);
    setWelcomeCount(0);

    setMessages([{
      id: `welcome-${taskId}-${Date.now()}`,
      from: 'System',
      user: 'Guest',
      text: '🌌 Cosmic channels realigned—welcome, Guest! Carve your legacy in the stars!',
      type: 'question',
      taskId,
      options: ['Type your name below!'],
      timestamp: new Date().toLocaleTimeString(),
      bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
    }]);
    setMessageIds(new Set([`welcome-${taskId}-${Date.now()}`]));
    initialLoadRef.current = true;
    scrollToBottom();
    setIsSending(false);
  }, [frontendId, userName, sessionId, scrollToBottom, isSending]);

  useEffect(() => {
    localStorage.setItem('frontendId', frontendId);
    localStorage.setItem('sessionId', sessionId);
    initializeWebSocket();
    initializeLocalWelcome();

    const reconnectInterval = setInterval(() => {
      if (!wsRef.current?.isConnected() && !connectionLock) {
        console.log(`[${new Date().toISOString()}] 🔄 ChatRoom: Triggering reconnect attempt ${reconnectAttempts + 1}`);
        setReconnectAttempts((prev) => prev + 1);
        initializeWebSocket();
      }
    }, 5000);

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      clearInterval(reconnectInterval);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setConnectionLock(false);
    };
  }, [initializeWebSocket, initializeLocalWelcome, frontendId, sessionId, connectionLock, reconnectAttempts]);

  useEffect(() => {
    try {
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
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ ChatRoom: Error updating color scheme: ${err.message}`);
      setError(`Color scheme update failed: ${err.message}`);
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
      if (initialLoadRef.current) {
        chatContainerRef.current.scrollTop = 0;
        initialLoadRef.current = false;
      } else {
        scrollToBottom();
      }
    }
  }, [messages, isTyping, scrollToBottom]);

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

  const sendMessage = useCallback((messageText) => {
    if (!messageText.trim() || isSending || !frontendId) {
      setError(!frontendId ? 'Missing frontend ID. Please reconnect.' : 'Sending in progress. Please wait.');
      return;
    }

    setIsSending(true);

    try {
      const taskId = currentTask ? currentTask.taskId : `initial:${frontendId}`;
      const messageData = {
        text: messageText.trim(),
        type: messageText.startsWith('/') ? 'command' : 'task_response',
        frontendId,
        ip: window.location.hostname,
        target: 'bot_lead',
        user: userName,
        sessionId,
        taskId,
        commandFlag: messageText.startsWith('/') ? true : undefined,
      };

      const userMessage = {
        id: `${taskId}-${messageText.slice(0, 50)}-${Date.now()}`,
        from: 'You',
        user: userName,
        text: messageText.trim(),
        type: messageText.startsWith('/') ? 'command' : 'task_response',
        timestamp: new Date().toLocaleTimeString(),
        bubbleStyle: { background: 'linear-gradient(135deg, #00ffcc, #00ccff)', color: '#000' },
        taskId,
      };

      setMessages((prev) => {
        if (messageIds.has(userMessage.id)) {
          console.log(`[${new Date().toISOString()}] 🔄 ChatRoom: Duplicate user message ignored: ${userMessage.id}`);
          return prev;
        }
        return [...prev, userMessage];
      });
      setPersistentMessages((prevPersistent) => {
        if (messageIds.has(userMessage.id)) return prevPersistent;
        const newPersistent = [...prevPersistent, userMessage];
        return newPersistent.length > 50 ? newPersistent.slice(-50) : newPersistent;
      });
      setMessageIds((prevIds) => new Set(prevIds).add(userMessage.id));

      if (messageText.startsWith('/')) {
        messageData.commandFlag = true;
        const commandParts = messageText.split(' ');
        const command = commandParts[0].toLowerCase();

        if (command === '/commands') {
          const commandList = commands.map((cmd) => `${cmd.command}: ${cmd.description}`).join('\n');
          setMessages((prev) => {
            const commandMsg = {
              id: `${taskId}-commands-${Date.now()}`,
              from: 'System',
              user: userName,
              text: `🌟 Cosmic Command Codex:\n${commandList}`,
              type: 'system',
              taskId,
              timestamp: new Date().toLocaleTimeString(),
              bubbleStyle: { background: 'linear-gradient(135deg, #ffcc00, #ff6600)', color: '#333' },
            };
            if (messageIds.has(commandMsg.id)) return prev;
            return [...prev, commandMsg];
          });
          setMessageIds((prevIds) => new Set(prevIds).add(`${taskId}-commands-${Date.now()}`));
        } else if (wsRef.current) {
          wsRef.current.emit('message', messageData);
          console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued command message: ${messageText}`);
        } else {
          console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, command queued: ${messageText}`);
        }
      } else {
        if (currentTask) {
          if (currentTask.step === 'name' && currentTask.taskId.startsWith('initial')) {
            const newUserName = messageText.trim();
            setUserName(newUserName);
            localStorage.setItem('crackerBotUserName', newUserName);
            if (wsRef.current) {
              wsRef.current.setUserName(newUserName);
              messageData.user = newUserName;
              setCurrentTask((prev) => ({
                ...prev,
                step: 'choice',
                taskStatus: 'pending',
              }));
              wsRef.current.emit('message', messageData);
              console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued name submission: ${newUserName}`);
              if (!isConnected) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `choice-${taskId}-${Date.now()}`,
                    from: 'System',
                    user: newUserName,
                    text: `🌟 Welcome, ${newUserName}! Choose your galactic path!`,
                    type: 'question',
                    taskId,
                    options: ['Chat', 'Build-Something-Epic'],
                    timestamp: new Date().toLocaleTimeString(),
                    bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
                  },
                ]);
                setTaskPending({
                  taskId,
                  question: `Choose your galactic path!`,
                  options: ['Chat', 'Build-Something-Epic'],
                });
              }
            } else {
              console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, name queued: ${newUserName}`);
              setCurrentTask((prev) => ({
                ...prev,
                step: 'choice',
                taskStatus: 'pending',
              }));
              setMessages((prev) => [
                ...prev,
                {
                  id: `choice-${taskId}-${Date.now()}`,
                  from: 'System',
                  user: newUserName,
                  text: `🌟 Welcome, ${newUserName}! Choose your galactic path!`,
                  type: 'question',
                  taskId,
                  options: ['Chat', 'Build-Something-Epic'],
                  timestamp: new Date().toLocaleTimeString(),
                  bubbleStyle: { background: 'linear-gradient(135deg, #ff00cc, #3333ff)', color: '#fff' },
                  },
                ]);
                setTaskPending({
                  taskId,
                  question: `Choose your galactic path!`,
                  options: ['Chat', 'Build-Something-Epic'],
                });
              }
            } else if (currentTask.step === 'choice' && messageText.toLowerCase() === 'build-something-epic') {
              setCurrentTask((prev) => ({
                ...prev,
                step: 'project_name',
                taskId: `task:${Date.now()}`,
                taskStatus: 'pending',
              }));
              if (wsRef.current) {
                wsRef.current.emit('message', messageData);
                console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued build-something-epic message`);
              } else {
                console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, build-something-epic message queued`);
              }
            } else if (currentTask.step === 'project_name') {
              const projectName = messageText.trim();
              setCurrentTask((prev) => ({
                ...prev,
                name: projectName,
                step: 'type',
                taskStatus: 'pending',
              }));
              messageData.taskName = projectName;
              if (wsRef.current) {
                wsRef.current.emit('message', messageData);
                console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued project name: ${projectName}`);
              } else {
                console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, project name queued: ${projectName}`);
              }
            } else if (currentTask.step === 'type') {
              setCurrentTask((prev) => ({
                ...prev,
                type: messageText.trim(),
                step: 'pending_features',
                taskStatus: 'pending',
              }));
              messageData.taskType = messageText.trim();
              if (wsRef.current) {
                wsRef.current.emit('message', messageData);
                console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued project type: ${messageText}`);
              } else {
                console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, project type queued: ${messageText}`);
              }
            } else if (currentTask.step === 'pending_features') {
              setCurrentTask((prev) => ({
                ...prev,
                features: messageText.trim(),
                step: 'building',
                taskStatus: 'building',
              }));
              messageData.taskFeatures = messageText.trim();
              if (wsRef.current) {
                wsRef.current.emit('message', messageData);
                console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued features: ${messageText}`);
              } else {
                console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, features queued: ${messageText}`);
              }
            } else if (wsRef.current) {
              wsRef.current.emit('message', messageData);
              console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued message: ${messageText}`);
            } else {
              console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, message queued: ${messageText}`);
            }
          } else {
            setCurrentTask({ taskId: `initial:${frontendId}`, step: 'name', taskStatus: 'pending' });
            if (wsRef.current) {
              wsRef.current.emit('message', messageData);
              console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued initial message: ${messageText}`);
            } else {
              console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, initial message queued: ${messageText}`);
            }
          }
        }

        setInput('');
        setShowCommands(false);
        setCommandIndex(-1);
        scrollToBottom();
      } catch (err) {
        console.error(`[${new Date().toISOString()}] 💥 ChatRoom: Send message error: ${err.message}`);
        setError(`Message queued, awaiting cosmic relay reconnection: ${err.message}`);
      } finally {
        setIsSending(false);
      }
    }, [currentTask, userName, frontendId, sessionId, scrollToBottom, messageIds, isConnected]);

    const handleInputChange = useCallback((e) => {
      const value = e.target.value;
      setInput(value);
      if (value.startsWith('/')) {
        const query = value.slice(1).toLowerCase();
        const filtered = commands.filter((cmd) => cmd.command.toLowerCase().startsWith(query));
        setFilteredCommands(filtered);
        setShowCommands(true);
        setCommandIndex(filtered.length > 0 ? 0 : -1);
        if (wsRef.current?.isConnected()) {
          const now = Date.now();
          if (now - lastHeartbeat > 1000) {
            wsRef.current.emit('typing', { frontendId, ip: window.location.hostname, sessionId });
            setLastHeartbeat(now);
          }
        }
      } else {
        setShowCommands(false);
        setCommandIndex(-1);
        if (wsRef.current?.isConnected()) {
          const now = Date.now();
          if (now - lastHeartbeat > 1000) {
            wsRef.current.emit('typing', { frontendId, ip: window.location.hostname, sessionId });
            setLastHeartbeat(now);
          }
        }
      }
    }, [frontendId, lastHeartbeat, sessionId]);

    const handleKeyDown = useCallback((e) => {
      if (e.key === 'Enter' && input.trim() && !isSending) {
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
    }, [input, showCommands, commandIndex, filteredCommands, sendMessage, isSending]);

    const handleCommandSelect = useCallback((command) => {
      setInput(command + ' ');
      setShowCommands(false);
      setCommandIndex(-1);
      inputRef.current?.focus();
    }, []);

    const toggleRecording = useCallback(() => {
      if (!isRecording) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setError('🎤 Mic’s offline—type your cosmic will, star voyager!');
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
          setError(`🎤 Mic malfunction: ${event.error === 'no-speech' ? 'Silence detected!' : event.error}. Type it out, cosmic creator!`);
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

    const handleColorChange = useCallback((scheme) => {
      setColorScheme(scheme);
      localStorage.setItem('colorScheme', scheme);
    }, []);

    const handleOptionClick = useCallback((option, projectData) => {
      if (projectData) {
        const { taskId, content, fileName, user } = projectData.projectData || {};
        if (!taskId) return;

        if (option === 'Refine Project') {
          setCurrentTask({ taskId, step: 'pending_features', taskStatus: 'pending' });
          setTaskPending({ taskId, question: `Amplify "${projectData.text}" with supernova features!`, options: [] });
          if (wsRef.current) {
            wsRef.current.emit('message', {
              text: 'Refine Project',
              type: 'task_response',
              taskId,
              frontendId,
              ip: window.location.hostname,
              target: 'bot_lead',
              user: user || userName,
              sessionId,
            });
            console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued refine project message for taskId: ${taskId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, refine project message queued for taskId: ${taskId}`);
          }
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
                id: `${taskId}-download-${Date.now()}`,
                from: 'System',
                user: user || userName,
                text: `🌌 Beaming "${projectData.text}" to your starship—cosmic loot secured! 📡`,
                type: 'system',
                taskId,
                timestamp: new Date().toLocaleTimeString(),
                bubbleStyle: { background: 'linear-gradient(135deg, #00ff99, #0066ff)', color: '#fff' },
              },
            ]);
          }
        } else if (option === 'Delete') {
          if (wsRef.current) {
            wsRef.current.emit('message', {
              text: `/delete ${taskId}`,
              type: 'command',
              taskId,
              frontendId,
              ip: window.location.hostname,
              target: 'bot_lead',
              user: user || userName,
              sessionId,
            });
            console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued delete command for taskId: ${taskId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, delete command queued for taskId: ${taskId}`);
          }
        }
      } else {
        sendMessage(option);
        if (option === 'Restart' && currentTask) {
          if (wsRef.current) {
            wsRef.current.emit('message', {
              text: `/restart ${currentTask.taskId}`,
              type: 'command',
              taskId: currentTask.taskId,
              frontendId,
              ip: window.location.hostname,
              target: 'bot_lead',
              user: userName,
              sessionId,
            });
            console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued restart command for taskId: ${currentTask.taskId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, restart command queued for taskId: ${currentTask.taskId}`);
          }
          setEditMode(currentTask.taskId);
        } else if (option === 'Refine Project' && currentTask) {
          setCurrentTask((prev) => ({ ...prev, step: 'pending_features', taskStatus: 'pending' }));
          setTaskPending({ taskId: currentTask.taskId, question: `Enhance "${currentTask.name}" with galactic features!`, options: [] });
          if (wsRef.current) {
            wsRef.current.emit('message', {
              text: 'Refine Project',
              type: 'task_response',
              taskId: currentTask.taskId,
              frontendId,
              ip: window.location.hostname,
              target: 'bot_lead',
              user: userName,
              sessionId,
            });
            console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued refine project message for taskId: ${currentTask.taskId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, refine project message queued for taskId: ${currentTask.taskId}`);
          }
        } else if (option === 'Done' && currentTask) {
          const taskResult = messages.find((m) => m.taskId === currentTask.taskId && m.type === 'taskResult');
          if (wsRef.current) {
            wsRef.current.emit('message', {
              text: 'store_project',
              type: 'command',
              taskId: currentTask.taskId,
              frontendId,
              ip: window.location.hostname,
              target: 'bot_lead',
              user: userName,
              taskName: currentTask.name,
              taskType: currentTask.type,
              taskFeatures: currentTask.features,
              finalContent: taskResult?.finalContent,
              sessionId,
            });
            console.log(`[${new Date().toISOString()}] 📡 ChatRoom: Queued store_project command for taskId: ${currentTask.taskId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ⚠️ ChatRoom: WebSocket not initialized, store_project command queued for taskId: ${currentTask.taskId}`);
          }
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
      scrollToBottom();
    }, [currentTask, messages, sendMessage, userName, frontendId, sessionId, scrollToBottom]);

    const handlePreviewClick = useCallback((msg) => {
      setPreviewData({ fileContent: msg.finalContent, fileName: msg.fileName || `${msg.taskName || 'cosmic_download'}.zip`, taskId: msg.taskId });
    }, []);

    const closePreview = useCallback(() => {
      setPreviewData(null);
    }, []);

    const currentScheme = colorSchemes[colorScheme] || colorSchemes['neon'];

    return (
      <div className={`flex flex-col h-screen ${currentScheme.bg} ${currentScheme.text} overflow-hidden relative`}>
        <div className="connection-status fixed top-0 right-0 p-2 z-30" style={{ background: isConnected ? 'linear-gradient(135deg, #00ff99, #0066ff)' : 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' }}>
          {connectionStatus}
        </div>
        {error && (
          <div className="error-message fixed top-8 left-0 w-full z-20" style={{ background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff', padding: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            {error}
            <button onClick={() => initializeWebSocket()} className="ml-4 p-1 bg-gradient-to-r from-[#ff66ff] to-[#66ffff] text-white rounded hover:scale-105 transition-transform">
              Retry Connection
            </button>
            <button onClick={handleWarpReconnect} className="ml-2 p-1 bg-gradient-to-r from-[#ff66ff] to-[#66ffff] text-white rounded hover:scale-105 transition-transform">
              Warp Reconnect
            </button>
          </div>
        )}
        {colorScheme === 'matrix' && (
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" />
        )}
        {previewData && (
          <PreviewPopup
            fileContent={previewData.fileContent}
            fileName={previewData.fileName}
            onClose={closePreview}
            socket={wsRef.current}
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
              className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform ${isRecording ? 'scale-110' : ''}`}
            >
              {isRecording ? '🎙️' : '🎤'}
            </button>
            <button
              onClick={() => initializeWebSocket()}
              className={`p-1 rounded ${currentScheme.button} ${currentScheme.buttonText} hover:scale-105 transition-transform`}
            >
              Retry Connection
            </button>
            <button
              onClick={handleWarpReconnect}
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
          <div className={`chatroom-container ${editMode ? 'border-2 border-[#00ff9f] shadow-[0_0_15px_#00ff9f]' : ''}`}>
            <div
              ref={chatContainerRef}
              className={`flex-1 ${currentScheme.chatBg} border border-gray-700 rounded-lg p-4 overflow-y-auto max-h-[calc(100vh-200px)]`}
            >
              {messages.length === 0 && (
                <div className="text-gray-500 italic mb-2">
                  Awaiting cosmic grid connection...
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className="message-wrapper mb-2">
                  <ErrorBoundary>
                    <ChatMessage
                      message={msg}
                      taskResult={msg.type === 'taskResult' ? msg : null}
                      onOptionClick={handleOptionClick}
                      colorScheme={currentScheme}
                      progress={taskProgress[msg.taskId]}
                      setMessages={setMessages}
                      socket={wsRef.current}
                      onPreviewClick={msg.finalContent ? () => handlePreviewClick(msg) : null}
                    />
                  </ErrorBoundary>
                </div>
              ))}
              {Object.entries(isTyping).map(([user, typing]) => typing && (
                <div key={user} className="text-gray-500 italic mb-2">
                  {`${user} is forging cosmic wonders...`}
                </div>
              ))}
            </div>

            {currentTask && (
              <div className="text-[#00ff9f] my-2 font-mono border-t border-[#ff00ff] pt-2">
                🌟 Cosmic Creation in Progress: <br />
                Name: {currentTask.name || 'Unnamed Epic'} <br />
                Type: {currentTask.type || 'TBD'} <br />
                Features: {currentTask.features || 'Forging cosmic brilliance...'} <br />
                Status: {currentTask.taskStatus === 'building' ? `Building (${taskProgress[currentTask.taskId] || 0}%)` : currentTask.taskStatus}
                {currentTask.taskStatus === 'building' && (
                  <div className="task-progress-container">
                    <div className={`task-progress-bar ${taskProgress[currentTask.taskId] === 100 ? 'animate-supernova' : 'animate-star-pulse'}`}>
                      <div
                        className={`task-progress-fill ${taskProgress[currentTask.taskId] === 100 ? 'animate-fade-in' : 'animate-cosmic-wave'}`}
                        style={{ width: `${taskProgress[currentTask.taskId] || 0}%` }}
                      />
                      <span className="task-progress-text">
                        {`${taskProgress[currentTask.taskId] || 0}%${taskProgress[currentTask.taskId] === 100 ? ' - Cosmic Triumph! 🌌✨' : ' - Forging the Galaxy! 🚀'}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showCommands && (
              <div
                ref={commandsRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className={`absolute bottom-12 left-0 w-full max-w-[calc(72rem+400px)] ${currentScheme.chatBg} border border-[#ff00ff] rounded-md shadow-[0_0_10px_#ff00ff] p-2 z-20 max-h-64 overflow-y-auto`}
              >
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd, idx) => (
                    <div
                      key={cmd.command}
                      onClick={() => handleCommandSelect(cmd.command)}
                      className={`cursor-pointer p-2 rounded-lg ${idx === commandIndex ? 'bg-gray-600' : 'hover:bg-gray-700'} transition-colors`}
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
                    ? currentTask?.step === 'name' && currentTask.taskId.startsWith('initial')
                      ? '🌠 Claim your cosmic identity...'
                      : currentTask?.step === 'choice'
                      ? '🌟 Choose your galactic path: Chat or Build-Something-Epic'
                      : currentTask?.step === 'project_name'
                      ? '⚒️ Name your cosmic creation...'
                      : currentTask?.step === 'type'
                      ? '✨ Select your tech constellation...'
                      : currentTask?.step === 'pending_features'
                      ? '⚒️ Describe your stellar features...'
                      : currentTask?.step === 'building'
                      ? '🌌 Building in progress—stand by for cosmic brilliance!'
                      : `🌌 Answer: ${taskPending?.question || ''}`
                    : editMode
                    ? '🌠 Refine your interstellar masterpiece...'
                    : '🌌 Transmit your cosmic will or /command...'
                }
                className={`flex-1 p-2 rounded-l-md ${currentScheme.chatBg} border border-[#ff00ff] ${currentScheme.text} focus:outline-none focus:ring-2 focus:ring-[#00ff9f] focus:shadow-[0_0_10px_#00ff9f] transition-shadow`}
                disabled={currentTask?.step === 'building' && !taskPending}
              />
              <button
                onClick={toggleRecording}
                className={`p-2 bg-gradient-to-r from-[#ff00ff] to-[#00ffff] hover:from-[#ff66ff] to-[#66ffff] text-white rounded-md shadow-lg transform transition-all duration-200 ${isRecording ? 'scale-110' : ''}`}
              >
                {isRecording ? '🎙️' : '🎤'}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isSending || (currentTask?.step === 'building' && !taskPending)}
                className={`px-4 py-2 rounded-r-md transition ${
                  input.trim() && !isSending && !(currentTask?.step === 'building' && !taskPending)
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
}

export default ChatRoom;